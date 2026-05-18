import { DeliveryType, type AddressResponseDto } from './address.types';
import { filterAddressesByDeliveryType, reorderAddressListPreferredFirst } from './address.types';

function addr(id: string, deliveryType: DeliveryType, isDefault = false): AddressResponseDto {
  return {
    id,
    deliveryType,
    isDefault,
  } as AddressResponseDto;
}

describe('address.types helpers', () => {
  it('filterAddressesByDeliveryType', () => {
    const list = [addr('1', DeliveryType.Warehouse), addr('2', DeliveryType.Doors)];
    expect(filterAddressesByDeliveryType(list, DeliveryType.Doors).map((a) => a.id)).toEqual(['2']);
    expect(filterAddressesByDeliveryType(list, null).length).toBe(2);
  });

  it('reorderAddressListPreferredFirst moves preferred to front', () => {
    const list = [addr('1', DeliveryType.Warehouse), addr('2', DeliveryType.Warehouse)];
    const reordered = reorderAddressListPreferredFirst(list, '2');
    expect(reordered[0].id).toBe('2');
  });

  it('reorderAddressListPreferredFirst uses isDefault fallback', () => {
    const list = [addr('1', DeliveryType.Warehouse), addr('2', DeliveryType.Warehouse, true)];
    const reordered = reorderAddressListPreferredFirst(list, null);
    expect(reordered[0].id).toBe('2');
  });
});
