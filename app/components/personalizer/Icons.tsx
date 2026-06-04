import React from "react";

export const SearchIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 20 20"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="9" cy="9" r="5" />
    <line x1="16" y1="16" x2="12.5" y2="12.5" />
  </svg>
);

export const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 20 20"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="10" y1="5" x2="10" y2="15" />
    <line x1="5" y1="10" x2="15" y2="10" />
  </svg>
);

export const ImageIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 20 20"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="3" y="3" width="14" height="14" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="17 12 13 8 7 14 3 10 3 17" />
  </svg>
);

export const DuplicateIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 20 20"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="6" y="6" width="11" height="11" rx="1.5" ry="1.5" />
    <path d="M3 13V4a1 1 0 0 1 1-1h9" />
  </svg>
);

export const ExportIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 20 20"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M17 14v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3" />
    <polyline points="7 10 10 13 13 10" />
    <line x1="10" y1="3" x2="10" y2="13" />
  </svg>
);

export const TrashIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 20 20"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <polyline points="3 6 5 6 17 6" />
    <path d="M16 6v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <line x1="8" y1="10" x2="8" y2="15" />
    <line x1="12" y1="10" x2="12" y2="15" />
  </svg>
);

export const CloseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 20 20"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="15" y1="5" x2="5" y2="15" />
    <line x1="5" y1="5" x2="15" y2="15" />
  </svg>
);

export const EditIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 20 20"
    width="14"
    height="14"
    fill="currentColor"
    {...props}
  >
    <path d="M14.22 2.368a1 1 0 0 1 1.414 0l2 2a1 1 0 0 1 0 1.414l-9.5 9.5a1 1 0 0 1-.325.216l-3.5 1.5A1 1 0 0 1 3 17.5v-3.5a1 1 0 0 1 .216-.325l9.5-9.5ZM13.513 5.5l-8.514 8.514V16h2.007l8.514-8.514-2.007-2.007Zm1.293-1.293l.707.707.593-.593-.707-.707-.593.593Z" />
  </svg>
);

export const ExternalLinkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 20 20"
    width="14"
    height="14"
    fill="currentColor"
    {...props}
  >
    <path d="M13 12a1 1 0 0 1 1 1v3.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 16.5v-9A1.5 1.5 0 0 1 3.5 6H7a1 1 0 0 1 0 2H3.5v9h9V13a1 1 0 0 1 1-1zm1.5-8.5H11a1 1 0 0 1 0-2h4.5A1.5 1.5 0 0 1 17 3v4.5a1 1 0 0 1-2 0V4.5L10.7 8.8a1 1 0 0 1-1.4-1.4l4.2-4.3z" />
  </svg>
);

export const EyeballIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 20 20"
    width="14"
    height="14"
    fill="currentColor"
    {...props}
  >
    <path d="M10 4.5c-3.6 0-6.8 2.2-8.5 5.5 1.7 3.3 4.9 5.5 8.5 5.5s6.8-2.2 8.5-5.5c-1.7-3.3-4.9-5.5-8.5-5.5zm0 9c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm0-5.5c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
  </svg>
);

