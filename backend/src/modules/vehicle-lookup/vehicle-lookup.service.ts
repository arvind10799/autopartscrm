import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from '../../infrastructure/redis/redis-cache.service';
import type {
  VehicleLookupOption,
  VehicleLookupResponse,
} from './vehicle-lookup.types';

type NhtsaResponse<T> = {
  Count?: number;
  Message?: string;
  Results?: T[];
};

type NhtsaModel = {
  Model_ID?: number;
  Model_Name?: string;
};

const NHTSA_BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const VEHICLE_LOOKUP_CACHE_NAMESPACE = 'vehicle-lookup';
const DEFAULT_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_FILTERED_LOOKUP_RESULTS = 80;
const CURATED_VEHICLE_MAKES = [
  'Acura',
  'Alfa Romeo',
  'AMC',
  'Aston Martin',
  'Audi',
  'Bentley',
  'BMW',
  'Buick',
  'Cadillac',
  'Chevrolet',
  'Chrysler',
  'Daewoo',
  'Daihatsu',
  'Dodge',
  'Eagle',
  'Ferrari',
  'Fiat',
  'Fisker',
  'Ford',
  'Genesis',
  'Geo',
  'GMC',
  'Honda',
  'Hummer',
  'Hyundai',
  'Infiniti',
  'Isuzu',
  'Jaguar',
  'Jeep',
  'Kia',
  'Lamborghini',
  'Land Rover',
  'Lexus',
  'Lincoln',
  'Lotus',
  'Maserati',
  'Maybach',
  'Mazda',
  'McLaren',
  'Mercedes-Benz',
  'Mercury',
  'Mini',
  'Mitsubishi',
  'Nissan',
  'Oldsmobile',
  'Plymouth',
  'Polestar',
  'Pontiac',
  'Porsche',
  'Ram',
  'Rivian',
  'Rolls-Royce',
  'Saab',
  'Saturn',
  'Scion',
  'Smart',
  'Subaru',
  'Suzuki',
  'Tesla',
  'Toyota',
  'Volkswagen',
  'Volvo',
] as const;
const FALLBACK_MODELS_BY_MAKE: Record<string, string[]> = {
  amc: [
    'Ambassador',
    'AMX',
    'Concord',
    'Eagle',
    'Gremlin',
    'Hornet',
    'Javelin',
    'Matador',
    'Pacer',
    'Rambler',
    'Rebel',
    'Spirit',
  ],
  daewoo: ['Lanos', 'Leganza', 'Nubira'],
  daihatsu: ['Charade', 'Rocky'],
  eagle: ['Medallion', 'Premier', 'Summit', 'Talon', 'Vision'],
  geo: ['Metro', 'Prizm', 'Spectrum', 'Storm', 'Tracker'],
  hummer: ['H1', 'H2', 'H3'],
  isuzu: [
    'Amigo',
    'Ascender',
    'Axiom',
    'Hombre',
    'I-Mark',
    'Impulse',
    'Oasis',
    'Pickup',
    'Rodeo',
    'Trooper',
    'VehiCROSS',
  ],
  mercury: [
    'Capri',
    'Cougar',
    'Grand Marquis',
    'Marauder',
    'Mariner',
    'Milan',
    'Montego',
    'Monterey',
    'Mountaineer',
    'Mystique',
    'Sable',
    'Tracer',
    'Villager',
  ],
  oldsmobile: [
    '88',
    '98',
    'Achieva',
    'Alero',
    'Aurora',
    'Bravada',
    'Cutlass',
    'Intrigue',
    'Silhouette',
    'Toronado',
  ],
  plymouth: [
    'Acclaim',
    'Breeze',
    'Colt',
    'Grand Voyager',
    'Horizon',
    'Neon',
    'Prowler',
    'Sundance',
    'Voyager',
  ],
  pontiac: [
    'Aztek',
    'Bonneville',
    'Catalina',
    'Fiero',
    'Firebird',
    'G3',
    'G5',
    'G6',
    'G8',
    'Grand Am',
    'Grand Prix',
    'GTO',
    'Montana',
    'Solstice',
    'Sunfire',
    'Torrent',
    'Trans Sport',
    'Vibe',
  ],
  saab: ['9-2X', '9-3', '9-4X', '9-5', '9-7X', '900', '9000'],
  saturn: ['Astra', 'Aura', 'Ion', 'L-Series', 'Outlook', 'Relay', 'S-Series', 'Sky', 'Vue'],
  scion: ['FR-S', 'iA', 'iM', 'iQ', 'tC', 'xA', 'xB', 'xD'],
  smart: ['Fortwo'],
  suzuki: [
    'Aerio',
    'Equator',
    'Esteem',
    'Forenza',
    'Grand Vitara',
    'Kizashi',
    'Reno',
    'Samurai',
    'Sidekick',
    'Swift',
    'SX4',
    'Verona',
    'Vitara',
    'X-90',
    'XL-7',
  ],
};
const OTHER_MODEL_OPTION = 'Other';

@Injectable()
export class VehicleLookupService {
  private readonly logger = new Logger(VehicleLookupService.name);
  private readonly cacheTtlSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisCacheService: RedisCacheService,
  ) {
    this.cacheTtlSeconds = this.resolveCacheTtlSeconds();
  }

  getYears(): VehicleLookupResponse {
    const currentYear = new Date().getFullYear();
    const latestModelYear = currentYear + 1;
    const items = Array.from(
      { length: latestModelYear - 1900 + 1 },
      (_, index) => String(latestModelYear - index),
    ).map((year) => ({
      id: year,
      name: year,
    }));

    return { items };
  }

  async getMakes(search?: string): Promise<VehicleLookupResponse> {
    const normalizedSearch = this.normalizeSearch(search);

    return {
      items: this.filterOptions(this.getCuratedMakes(), normalizedSearch),
    };
  }

  async getModels(
    make: string,
    year?: string,
    search?: string,
  ): Promise<VehicleLookupResponse> {
    const normalizedMake = make.trim();

    if (!normalizedMake) {
      return { items: [] };
    }

    const normalizedYear = this.normalizeYear(year);
    const normalizedSearch = this.normalizeSearch(search);
    const curatedFallbackModels = this.getFallbackModelsForMake(normalizedMake);

    if (curatedFallbackModels.length > 0) {
      return {
        items: this.filterOptions(
          this.appendOtherOption(curatedFallbackModels),
          normalizedSearch,
        ),
      };
    }

    const cacheKey = `${VEHICLE_LOOKUP_CACHE_NAMESPACE}:models:${normalizedMake.toLowerCase()}:${normalizedYear ?? 'all'}`;
    const models = await this.redisCacheService.remember(
      cacheKey,
      this.cacheTtlSeconds,
      () => this.fetchModels(normalizedMake, normalizedYear),
    );
    const fallbackModels =
      models.length === 0 && normalizedYear
        ? await this.redisCacheService.remember(
            `${VEHICLE_LOOKUP_CACHE_NAMESPACE}:models:${normalizedMake.toLowerCase()}:all`,
            this.cacheTtlSeconds,
            () => this.fetchModels(normalizedMake),
          )
        : models;
    const resilientModels =
      fallbackModels.length > 0
        ? fallbackModels
        : this.getFallbackModelsForMake(normalizedMake);

    return {
      items: this.filterOptions(
        this.appendOtherOption(resilientModels),
        normalizedSearch,
      ),
    };
  }

  private async fetchModels(
    make: string,
    year?: string,
  ): Promise<VehicleLookupOption[]> {
    const makeSegment = encodeURIComponent(make);
    const url = year
      ? `${NHTSA_BASE_URL}/GetModelsForMakeYear/make/${makeSegment}/modelyear/${year}?format=json`
      : `${NHTSA_BASE_URL}/GetModelsForMake/${makeSegment}?format=json`;
    const payload = await this.fetchNhtsa<NhtsaModel>(url);

    return this.dedupeOptions(
      (payload.Results ?? [])
        .map((model) => ({
          id: String(model.Model_ID ?? model.Model_Name ?? ''),
          name: model.Model_Name ?? '',
        }))
        .filter((model) => model.name.trim().length > 0),
    );
  }

  private async fetchNhtsa<T>(url: string): Promise<NhtsaResponse<T>> {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Auto Parts CRM vehicle lookup',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new Error(`NHTSA returned ${response.status}`);
      }

      return (await response.json()) as NhtsaResponse<T>;
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Vehicle lookup request failed. ${details}`);

      return { Results: [] };
    }
  }

  private filterOptions(
    options: VehicleLookupOption[],
    search?: string,
  ): VehicleLookupOption[] {
    const filteredOptions = search
      ? options.filter((option) =>
          option.name.toLowerCase().includes(search.toLowerCase()),
        )
      : options;

    return search ? filteredOptions.slice(0, MAX_FILTERED_LOOKUP_RESULTS) : filteredOptions;
  }

  private getCuratedMakes(): VehicleLookupOption[] {
    return CURATED_VEHICLE_MAKES.map((make) => ({
      id: make.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: make,
    }));
  }

  private getFallbackModelsForMake(make: string): VehicleLookupOption[] {
    const fallbackModels =
      FALLBACK_MODELS_BY_MAKE[make.toLowerCase().replace(/[^a-z0-9]+/g, '')] ??
      [];

    return fallbackModels.map((model) => ({
      id: model.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: model,
    }));
  }

  private appendOtherOption(
    options: VehicleLookupOption[],
  ): VehicleLookupOption[] {
    if (
      options.some(
        (option) => option.name.toLowerCase() === OTHER_MODEL_OPTION.toLowerCase(),
      )
    ) {
      return options;
    }

    return [
      ...options,
      {
        id: 'other',
        name: OTHER_MODEL_OPTION,
      },
    ];
  }

  private dedupeOptions(options: VehicleLookupOption[]): VehicleLookupOption[] {
    const seen = new Set<string>();

    return options
      .map((option) => ({
        id: option.id.trim() || option.name.trim(),
        name: option.name.trim(),
      }))
      .filter((option) => {
        const key = option.name.toLowerCase();

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private normalizeSearch(search?: string): string | undefined {
    const normalizedSearch = search?.trim();

    return normalizedSearch && normalizedSearch.length >= 1
      ? normalizedSearch
      : undefined;
  }

  private normalizeYear(year?: string): string | undefined {
    const normalizedYear = year?.trim();

    return normalizedYear && /^\d{4}$/.test(normalizedYear)
      ? normalizedYear
      : undefined;
  }

  private resolveCacheTtlSeconds(): number {
    const rawValue = Number(
      this.configService.get<string>('VEHICLE_LOOKUP_CACHE_TTL_SECONDS'),
    );

    return Number.isFinite(rawValue) && rawValue > 0
      ? rawValue
      : DEFAULT_CACHE_TTL_SECONDS;
  }
}
