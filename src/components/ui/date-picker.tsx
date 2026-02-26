"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value?: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  className?: string;
}

const WEEK_DAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];

function parseDate(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDate(value?: string): string {
  const date = parseDate(value);

  if (!date) {
    return "Brak terminu";
  }

  return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function sameDay(left: Date | null, right: Date): boolean {
  if (!left) {
    return false;
  }

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function DatePicker({ value, onChange, placeholder = "Wybierz datę", className }: DatePickerProps) {
  const selectedDate = parseDate(value);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => selectedDate ?? new Date());

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekDay = (firstDay.getDay() + 6) % 7;
    const monthLength = new Date(year, month + 1, 0).getDate();
    const cells: Array<Date | null> = [];

    for (let index = 0; index < firstWeekDay; index += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= monthLength; day += 1) {
      cells.push(new Date(year, month, day));
    }

    return cells;
  }, [visibleMonth]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("w-full justify-between text-left font-normal", className)}>
          <span className={value ? "text-content-primary" : "text-content-muted"}>{value ? formatDate(value) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="start">
        <div className="mb-2 flex items-center justify-between">
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setVisibleMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <p className="text-sm font-medium text-content-primary">
            {new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(visibleMonth)}
          </p>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setVisibleMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEK_DAYS.map((dayName) => (
            <span key={dayName} className="text-center text-xs text-content-muted">
              {dayName}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) =>
            date ? (
              <Button
                key={toIsoDate(date)}
                type="button"
                size="icon"
                variant={sameDay(selectedDate, date) ? "default" : "ghost"}
                className="h-8 w-8 text-xs"
                onClick={() => onChange(toIsoDate(date))}
              >
                {date.getDate()}
              </Button>
            ) : (
              <span key={`empty-${index}`} className="h-8 w-8" />
            )
          )}
        </div>

        <div className="mt-3 flex justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Wyczyść
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
