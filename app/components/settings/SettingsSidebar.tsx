import React from "react";

interface Category {
  id: string;
  name: string;
  desc: string;
}

interface SettingsSidebarProps {
  categories: Category[];
  activeCategory: string;
  setActiveCategory: (id: string) => void;
}

export function SettingsSidebar({
  categories,
  activeCategory,
  setActiveCategory,
}: SettingsSidebarProps) {
  return (
    <s-box padding="base" background="base" border="base" borderRadius="base">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={`category-item ${activeCategory === cat.id ? "active" : ""}`}
          onClick={() => setActiveCategory(cat.id)}
        >
          <span className="category-name">{cat.name}</span>
          <span className="category-desc">{cat.desc}</span>
        </button>
      ))}
    </s-box>
  );
}
