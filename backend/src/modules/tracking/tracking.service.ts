import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateShipmentEventDto } from './dto/create-shipment-event.dto';
import { TrackingRepository } from './tracking.repository';

@Injectable()
export class TrackingService {
  constructor(
    private readonly trackingRepository: TrackingRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createShipmentEventDto: CreateShipmentEventDto) {
    await this.ensureShipmentExists(createShipmentEventDto.shipmentId);

    const event = await this.trackingRepository.create(createShipmentEventDto);
    await this.notificationsService.notifyShipmentActivity(
      createShipmentEventDto.shipmentId,
      'Tracking activity was added.',
    );

    return event;
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
