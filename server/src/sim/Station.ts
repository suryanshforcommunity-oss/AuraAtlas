export interface StationDict {
  id: number;
  x: number;
  y: number;
  type: 'pick' | 'drop';
  current: number;
  max: number;
  priority: number;
  pct: number;
  reserved_pick: number;
  reserved_drop: number;
}

export class Station {
  private static counter = 0;

  static resetCounter(): void {
    Station.counter = 0;
  }

  id: number;
  x: number;
  y: number;
  type: 'pick' | 'drop';
  maxCapacity: number;
  current: number;
  priority: number; // 1-3
  reservedPick: number;
  reservedDrop: number;

  constructor(x: number, y: number, type: 'pick' | 'drop', capacity?: number) {
    Station.counter++;
    this.id = Station.counter;
    this.x = x;
    this.y = y;
    this.type = type;
    this.maxCapacity = capacity !== undefined ? capacity : (type === 'drop' ? 99 : 12);
    this.current = type === 'pick' ? this.maxCapacity : 0;
    this.priority = 1;
    this.reservedPick = 0;
    this.reservedDrop = 0;
  }

  canPickup(qty = 1): boolean {
    return (this.current - this.reservedPick) >= qty;
  }

  canDrop(qty = 1): boolean {
    return (this.maxCapacity - this.current - this.reservedDrop) >= qty;
  }

  reservePickup(qty = 1): void {
    this.reservedPick += qty;
  }

  releasePickupReservation(qty = 1): void {
    this.reservedPick = Math.max(0, this.reservedPick - qty);
  }

  reserveDrop(qty = 1): void {
    this.reservedDrop += qty;
  }

  releaseDropReservation(qty = 1): void {
    this.reservedDrop = Math.max(0, this.reservedDrop - qty);
  }

  doPickup(qty = 1): number {
    const actual = Math.min(qty, this.current);
    this.current -= actual;
    this.reservedPick = Math.max(0, this.reservedPick - qty);
    return actual;
  }

  doDrop(qty = 1): number {
    const availableSpace = Math.max(0, this.maxCapacity - this.current);
    const actual = Math.min(qty, availableSpace);
    this.current += actual;
    this.reservedDrop = Math.max(0, this.reservedDrop - qty);
    return actual;
  }

  restock(qty = 4): number {
    this.current = Math.min(this.maxCapacity, this.current + qty);
    return qty;
  }

  toDict(): StationDict {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      type: this.type,
      current: this.current,
      max: this.maxCapacity,
      priority: this.priority,
      pct: this.maxCapacity ? Math.round((this.current / this.maxCapacity) * 100) : 0,
      reserved_pick: this.reservedPick,
      reserved_drop: this.reservedDrop,
    };
  }
}
