import React from "react";

interface Tab {
  id: string;
  name: string;
  desc?: string;
}

interface SettingsTabNavProps {
  tabs: Tab[];
  activeTab: string;
  setActiveTab: (id: string) => void;
  brandColor?: string;
}

export function SettingsTabNav({
  tabs,
  activeTab,
  setActiveTab,
  brandColor = "#008060",
}: SettingsTabNavProps) {
  return (
    <div className="settings-tab-container">
      <style>{`
        .settings-tab-container {
          background: #fafafa;
          border-bottom: 1px solid #ebebeb;
          padding: 0 16px;
          display: flex;
          gap: 8px;
          border-radius: 8px 8px 0 0;
        }
        .settings-tab-item {
          background: none;
          border: none;
          padding: 14px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #6d7175;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
        }
        .settings-tab-item:hover {
          color: #1a1a1a;
        }
        .settings-tab-item.active {
          color: #1a1a1a;
          border-bottom-color: ${brandColor};
        }
        .settings-tab-desc {
          font-size: 10px;
          font-weight: 400;
          color: #8c9196;
          margin-top: 2px;
        }
        .settings-tab-item.active .settings-tab-desc {
          color: #6d7175;
        }
      `}</style>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`settings-tab-item ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span>{tab.name}</span>
          {tab.desc && <span className="settings-tab-desc">{tab.desc}</span>}
        </button>
      ))}
    </div>
  );
}
