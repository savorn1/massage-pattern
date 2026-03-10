import { MessageDocument } from '@/modules/shared/entities';

export class MessagesAroundDto {
  data: MessageDocument[];
  total: number;
  hasOlder: boolean;
  hasNewer: boolean;
}
