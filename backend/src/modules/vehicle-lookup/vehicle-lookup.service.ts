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

type NhtsaMake = {
  Make_ID?: number;
  MakeId?: number;
  Make_Name?: string;
  MakeName?: string;
};

type NhtsaModel = {
  Model_ID?: number;
  Model_Name?: string;
};

const NHTSA_BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const VEHICLE_LOOKUP_CACHE_NAMESPACE = 'vehicle-lookup';
const DEFAULT_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_LOOKUP_RESULTS = 80;

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
      { length: latestModelYear - 1995 + 1 },
      (_, index) => String(latestModelYear - index),
    ).map((year) => ({
      id: year,
      name: year,
    }));

    return { items };
  }

  async getMakes(search?: string): Promise<VehicleLookupResponse> {
    const normalizedSearch = this.normalizeSearch(search);
    const makes = await this.redisCacheService.remember(
      `${VEHICLE_LOOKUP_CACHE_NAMESPACE}:makes:all`,
      this.cacheTtlSeconds,
      () => this.fetchMakes(),
    );

    return {
      items: this.filterOptions(makes, normalizedSearch),
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
    const cacheKey = `${VEHICLE_LOOKUP_CACHE_NAMESPACE}:models:${normalizedMake.toLowerCase()}:${normalizedYear ?? 'all'}`;
    const models = await this.redisCacheService.remember(
      cacheKey,
      this.cacheTtlSeconds,
      () => this.fetchModels(normalizedMake, normalizedYear),
    );

    return {
      items: this.filterOptions(models, normalizedSearch),
    };
  }

  private async fetchMakes(): Promise<VehicleLookupOption[]> {
    const payload = await this.fetchNhtsa<NhtsaMake>(
      `${NHTSA_BASE_URL}/GetAllMakes?format=json`,
    );

    return this.dedupeOptions(
      (payload.Results ?? [])
        .map((make) => ({
          id: String(make.Make_ID ?? make.MakeId ?? make.Make_Name ?? make.MakeName ?? ''),
          name: make.Make_Name ?? make.MakeName ?? '',
        }))
        .filter((make) => make.name.trim().length > 0),
    );
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

    return filteredOptions.slice(0, MAX_LOOKUP_RESULTS);
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

