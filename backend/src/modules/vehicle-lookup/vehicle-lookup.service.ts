import { Injectable } from '@nestjs/common';
import {
  DOCUMENT_MODELS_BY_MAKE,
  DOCUMENT_PART_OPTIONS,
  DOCUMENT_VEHICLE_MAKES,
} from './vehicle-lookup-data';
import type { VehicleLookupOption, VehicleLookupResponse } from './vehicle-lookup.types';

const MAX_FILTERED_LOOKUP_RESULTS = 80;

@Injectable()
export class VehicleLookupService {
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

  getMakes(search?: string): VehicleLookupResponse {
    return {
      items: this.filterOptions(
        DOCUMENT_VEHICLE_MAKES.map((make) => this.toOption(make)),
        this.normalizeSearch(search),
      ),
    };
  }

  getModels(make: string, search?: string): VehicleLookupResponse {
    const normalizedMake = make.trim();

    if (!normalizedMake) {
      return { items: [] };
    }

    const matchedMake = this.findDocumentMake(normalizedMake);

    if (!matchedMake) {
      return { items: [] };
    }

    return {
      items: this.filterOptions(
        DOCUMENT_MODELS_BY_MAKE[matchedMake].map((model) => this.toOption(model)),
        this.normalizeSearch(search),
      ),
    };
  }

  getParts(search?: string): VehicleLookupResponse {
    return {
      items: this.filterOptions(
        DOCUMENT_PART_OPTIONS.map((part) => this.toOption(part)),
        this.normalizeSearch(search),
      ),
    };
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

    return search
      ? filteredOptions.slice(0, MAX_FILTERED_LOOKUP_RESULTS)
      : filteredOptions;
  }

  private findDocumentMake(make: string) {
    const normalizedMake = this.normalizeKey(make);

    return DOCUMENT_VEHICLE_MAKES.find(
      (documentMake) => this.normalizeKey(documentMake) === normalizedMake,
    );
  }

  private normalizeSearch(search?: string): string | undefined {
    const normalizedSearch = search?.trim();

    return normalizedSearch && normalizedSearch.length >= 1
      ? normalizedSearch
      : undefined;
  }

  private normalizeKey(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private toOption(name: string): VehicleLookupOption {
    return {
      id: this.normalizeKey(name) || name,
      name,
    };
  }
}
