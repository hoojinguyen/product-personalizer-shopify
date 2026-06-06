import { useState, useRef, useEffect } from "react";

interface OrdersToolbarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
}

export function OrdersToolbar({
  searchQuery,
  setSearchQuery,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: OrdersToolbarProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Close date picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const getDisplayDateRange = () => {
    if (startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    } else if (startDate) {
      return `From ${formatDate(startDate)}`;
    } else if (endDate) {
      return `To ${formatDate(endDate)}`;
    }
    return "Filter by date";
  };

  return (
    <div className="toolbar-wrapper">
      <div className="filter-tools">
        {/* Search Field */}
        <div className="search-wrapper">
          <span className="search-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input
            type="text"
            placeholder="filter order"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="orders-input search-input"
          />
        </div>

        {/* Custom Date Range Picker Dropdown */}
        <div className="date-picker-container" ref={datePickerRef} style={{ position: "relative" }}>
          <button
            type="button"
            className="date-picker-trigger-btn"
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
          >
            <svg className="calendar-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="date-range-text">{getDisplayDateRange()}</span>
            <svg className="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {isDatePickerOpen && (
            <div className="date-picker-dropdown-popover">
              <div className="date-inputs-row">
                <div className="date-input-group">
                  <label htmlFor="date-from">From</label>
                  <input
                    id="date-from"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="orders-input date-field-input"
                  />
                </div>
                <div className="date-input-group">
                  <label htmlFor="date-to">To</label>
                  <input
                    id="date-to"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="orders-input date-field-input"
                  />
                </div>
              </div>
              <div className="date-picker-footer">
                {(startDate || endDate) && (
                  <button
                    type="button"
                    className="clear-dates-btn"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                  >
                    Clear Dates
                  </button>
                )}
                <button
                  type="button"
                  className="apply-dates-btn"
                  onClick={() => setIsDatePickerOpen(false)}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
