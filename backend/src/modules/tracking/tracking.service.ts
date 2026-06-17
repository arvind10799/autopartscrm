import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateShipmentEventDto } from './dto/create-shipment-event.dto';
import { TrackingRepository } from './tracking.repository';

@Injectable()
export class TrackingService {
  constructor(private readonly trackingRepository: TrackingRepository) {}

  async create(createShipmentEventDto: CreateShipmentEventDto) {
    await this.ensureShipmentExists(createShipmentEventDto.shipmentId);

    return this.trackingRepository.create(createShipmentEventDto);
  }

  findTimelineByShipmentId(shipmentId: string) {
    return this.trackingRepository.findTimelineByShipmentId(shipmentId);
  }

  private async ensureShipmentExists(shipmentId: string): Promise<void> {
    const exists = await this.trackingRepository.existsShipmentById(shipmentId);

    if (!exists) {
      throw new NotFoundException('Shipment was not found.');
    }
  }
}
