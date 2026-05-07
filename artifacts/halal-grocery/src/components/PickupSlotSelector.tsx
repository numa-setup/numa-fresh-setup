import { useState } from 'react';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';

interface Slot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  availableCapacity: number;
  maxCapacity: number;
}

interface PickupSlotSelectorProps {
  slots: Slot[];
  value: string | null;
  onChange: (slotId: string) => void;
}

export function PickupSlotSelector({ slots, value, onChange }: PickupSlotSelectorProps) {
  const today = startOfDay(new Date());
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const slotsForDate = slots.filter(slot => {
    const slotDate = startOfDay(new Date(slot.date));
    return isSameDay(slotDate, selectedDate);
  });

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Select Date</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {dates.map(date => {
            const hasSlots = slots.some(s => isSameDay(startOfDay(new Date(s.date)), date));
            const isSelected = isSameDay(date, selectedDate);
            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                disabled={!hasSlots}
                className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border/50 hover:border-primary/40'
                }`}
              >
                <span className="text-xs text-muted-foreground">{format(date, 'EEE')}</span>
                <span className="font-semibold">{format(date, 'd')}</span>
                {isSameDay(date, today) && <span className="text-[10px] text-primary">Today</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Select Time</span>
        </div>
        {slotsForDate.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">No available slots for this date</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slotsForDate.map(slot => {
              const isSelected = value === slot.id;
              const isFull = slot.availableCapacity === 0;
              const isAlmostFull = slot.availableCapacity <= 2;
              return (
                <button
                  key={slot.id}
                  onClick={() => !isFull && onChange(slot.id)}
                  disabled={isFull}
                  className={`px-3 py-2.5 rounded-xl border text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected
                      ? 'border-primary bg-primary/5 text-primary shadow-sm'
                      : isFull
                      ? 'border-border/30 bg-muted/30'
                      : 'border-border/50 hover:border-primary/40'
                  }`}
                >
                  <div className="font-medium">{slot.startTime}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {isFull ? 'Full' : isAlmostFull ? `${slot.availableCapacity} left` : 'Available'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
