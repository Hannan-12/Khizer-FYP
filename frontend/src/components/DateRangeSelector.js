import React from "react";
import "./DateRangeSelector.css";

export default function DateRangeSelector({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}) {
  return (
    <div className="date-range-selector">
      <h3>Date Range</h3>
      <div className="date-inputs">
        <div className="date-field">
          <label htmlFor="start-date">Start</label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        <div className="date-field">
          <label htmlFor="end-date">End</label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
