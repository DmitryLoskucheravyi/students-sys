// Власний набір іконок: контур кольором тексту, одна деталь — акцентом (клас ia).
const I = ({ size = 22, children, ...p }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);
const A = (p) => <path className="ia" {...p} />;

export const IconCalendar = (p) => <I {...p}><path d="M4 9.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19V6.5A1.5 1.5 0 0 0 18.500 5h-13A1.500 1.500 0 0 0 4 6.500v3h16M8 3v4M16 3v4"/><A d="M8.500 15l2.500 2.800 4.500-5.600"/></I>;
export const IconLesson = (p) => <I {...p}><path d="M6.500 3h11A1.500 1.500 0 0 1 19 4.500v15a1.500 1.500 0 0 1-1.500 1.500h-11A1.500 1.500 0 0 1 5 19.500v-15A1.500 1.500 0 0 1 6.500 3zM12 8h4M12 12h4"/><A d="M9 3v18"/></I>;
export const IconRoadmap = (p) => <I {...p}><path d="M6 20.500h9.500a3.250 3.250 0 0 0 0-6.500h-7a3.250 3.250 0 0 1 0-6.500H12"/><A d="M16 10V3l4.500 2.200L16 7.400"/><circle cx="5" cy="20.500" r="1.200"/></I>;
export const IconTicket = (p) => <I {...p}><path d="M3 7.500A1.500 1.500 0 0 1 4.500 6h15A1.500 1.500 0 0 1 21 7.500V10a2 2 0 0 0 0 4v2.500a1.500 1.500 0 0 1-1.500 1.500h-15A1.500 1.500 0 0 1 3 16.500V14a2 2 0 0 0 0-4z"/><A d="M15 6.500v2M15 11v2M15 15.500v2"/></I>;
export const IconPeople = (p) => <I {...p}><circle cx="9" cy="8" r="3.500"/><path d="M2.500 20c.5-3.800 3-6 6.500-6s6 2.200 6.500 6"/><A d="M16 4.800a3.400 3.400 0 0 1 0 6.400M18.500 14.500c1.700.9 2.700 2.800 3 5.500"/></I>;
export const IconHomework = (p) => <I {...p}><path d="M13 3H6.500A1.500 1.500 0 0 0 5 4.500v15A1.500 1.500 0 0 0 6.500 21h11a1.500 1.500 0 0 0 1.500-1.500V13M8.500 8.500h4M8.500 12.500h2"/><A d="M18.500 3.200l2.300 2.300-7.300 7.300-3 .7.700-3z"/></I>;
export const IconTick = (p) => <I {...p}><path d="M4 13l5.200 6.200L20.500 4.500" strokeWidth="2.600"/></I>;
export const IconExternal = (p) => <I {...p}><path d="M18 13.500v5A1.500 1.500 0 0 1 16.500 20h-11A1.500 1.500 0 0 1 4 18.500v-11A1.500 1.500 0 0 1 5.500 6h5"/><A d="M14 4h6v6M20 4l-9 9"/></I>;
export const IconChart =(p) => <I {...p}><path d="M4 20.500h16M6.500 20.500V12M11 20.500V6.500M15.500 20.500v-6"/><A d="M18.500 3.500l2 2-2 2M20 5.500h-3.500"/></I>;
export const IconSpark =(p) => <I {...p}><path d="M10.500 4c.8 4.600 2.900 6.700 7.500 7.500-4.600.8-6.700 2.900-7.500 7.500-.8-4.600-2.900-6.700-7.500-7.500 4.600-.8 6.700-2.900 7.500-7.500z"/><A d="M18.500 3v4M16.500 5h4M18.500 17.500v3M17 19h3"/></I>;
export const IconClose = (p) => <I {...p}><path d="M6 6l12 12M18 6L6 18"/></I>;
export const IconPlus = (p) => <I {...p}><path d="M12 5v14M5 12h14"/></I>;
export const IconMinus = (p) => <I {...p}><path d="M5 12h14"/></I>;
export const IconLeft = (p) => <I {...p}><path d="M14.500 5.500L8 12l6.500 6.500"/></I>;
export const IconRight = (p) => <I {...p}><path d="M9.500 5.500L16 12l-6.500 6.500"/></I>;
export const IconUp = (p) => <I {...p}><path d="M5.500 14.500L12 8l6.500 6.500"/></I>;
export const IconDown = (p) => <I {...p}><path d="M5.500 9.500L12 16l6.500-6.500"/></I>;
export const IconSun = (p) => <I {...p}><circle cx="12" cy="12" r="4"/><A d="M12 2.500v2.500M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300L7 7M17 17l1.700 1.700M18.700 5.300L17 7M7 17l-1.700 1.700"/></I>;
export const IconMoon = (p) => <I {...p}><path d="M20 14.500A8.500 8.500 0 0 1 9.500 4a8.500 8.500 0 1 0 10.500 10.500z"/><A d="M16.500 4v3M15 5.500h3"/></I>;
export const IconLogout = (p) => <I {...p}><path d="M10 4H6a1.500 1.500 0 0 0-1.500 1.500v13A1.500 1.500 0 0 0 6 20h4"/><A d="M10.500 12H20M16.500 8l4 4-4 4"/></I>;
export const IconKey = (p) => <I {...p}><circle cx="8" cy="15.500" r="4.500"/><A d="M11.300 12.200L20 3.500M16.500 7l3 3M13.500 10l2 2"/></I>;
export const IconClock = (p) => <I {...p}><circle cx="12" cy="12" r="8.500"/><A d="M12 7v5.300l3.300 2"/></I>;
export const IconPin = (p) => <I {...p}><path d="M12 21.500s7-6.300 7-11.500a7 7 0 1 0-14 0c0 5.200 7 11.500 7 11.500z"/><A d="M12 12.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z"/></I>;
export const IconEdit = (p) => <I {...p}><path d="M4 20h4L19.500 8.500l-4-4L4 16z"/><A d="M13.500 6.500l4 4"/></I>;
export const IconTrash = (p) => <I {...p}><path d="M6 7l1 13h10l1-13"/><A d="M4 7h16M9.500 7V4h5v3"/></I>;
export const IconRepeat = (p) => <I {...p}><path d="M4 11V9.500A3.500 3.500 0 0 1 7.500 6H19"/><path d="M20 13v1.500a3.500 3.500 0 0 1-3.500 3.500H5"/><A d="M16 3l3 3-3 3M8 21l-3-3 3-3"/></I>;
export const IconOnce = (p) => <I {...p}><circle cx="12" cy="12" r="8.500"/><A d="M10.200 9.500L12.500 8v8.500"/></I>;
export const IconMove = (p) => <I {...p}><path d="M5 19V7.500A1.500 1.500 0 0 1 6.500 6H12M19 12v7"/><path d="M5 19h14"/><A d="M16 2.500l3.500 3.500L16 9.500M19.500 6H14"/></I>;
export const IconBan = (p) => <I {...p}><circle cx="12" cy="12" r="8.500"/><A d="M6 6l12 12"/></I>;
export const IconUpload = (p) => <I {...p}><path d="M4.500 15v4A1.500 1.500 0 0 0 6 20.500h12a1.500 1.500 0 0 0 1.500-1.500v-4"/><A d="M12 16V4M7.500 8.500L12 4l4.500 4.500"/></I>;
export const IconFile = (p) => <I {...p}><path d="M13.500 3H7a1.500 1.500 0 0 0-1.500 1.500v15A1.500 1.500 0 0 0 7 21h10a1.500 1.500 0 0 0 1.500-1.500V8z"/><A d="M13.500 3v5h5"/></I>;
export const IconFolderZip = (p) => <I {...p}><path d="M3 18.500v-13A1.500 1.500 0 0 1 4.500 4h4.800l2.200 2.500h8A1.500 1.500 0 0 1 21 8v10.500a1.500 1.500 0 0 1-1.500 1.500h-15A1.500 1.500 0 0 1 3 18.500z"/><A d="M12.500 6.500V9M12.500 11v2M12.500 15v2.500"/></I>;
export const IconImage = (p) => <I {...p}><rect x="3" y="4.500" width="18" height="15" rx="1.500"/><A d="M3.500 17l5-5.500 3.500 3.500 3-3 5.500 5.500"/><circle cx="16" cy="8.800" r="1.300"/></I>;
export const IconDownload = (p) => <I {...p}><path d="M4.500 15v4A1.500 1.500 0 0 0 6 20.500h12a1.500 1.500 0 0 0 1.500-1.500v-4"/><A d="M12 4v12M7.500 11.500L12 16l4.500-4.500"/></I>;
export const IconEye = (p) => <I {...p}><path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle className="ia" cx="12" cy="12" r="2.800"/></I>;
export const IconEyeOff = (p) => <I {...p}><path d="M9.500 6c.8-.3 1.600-.5 2.500-.5 6 0 9.500 6.500 9.500 6.500a17 17 0 0 1-2.500 3.300M6.200 7.500A16 16 0 0 0 2.500 12S6 18.500 12 18.500c1.500 0 2.800-.4 4-1"/><A d="M4 4l16 16"/></I>;
export const IconDice = (p) => <I {...p}><rect x="4" y="4" width="16" height="16" rx="2.500"/><A d="M9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01" strokeWidth="2.600"/></I>;
export const IconUser = (p) => <I {...p}><circle cx="12" cy="8" r="4"/><A d="M4.500 20.500c.7-4 3.600-6.500 7.500-6.500s6.800 2.500 7.500 6.500"/></I>;
export const IconArchive = (p) => <I {...p}><path d="M5 9v10a1.500 1.500 0 0 0 1.500 1.500h11A1.500 1.500 0 0 0 19 19V9"/><path d="M3.500 4.500h17V9h-17z"/><A d="M10 13h4"/></I>;
export const IconRestore = (p) => <I {...p}><path d="M5.500 8A8 8 0 1 1 4 12.500"/><A d="M4.500 3.500V8.500h5"/></I>;
export const IconList = (p) => <I {...p}><A d="M4 6.500l1.500 1.500L8 5M4 13.500l1.500 1.500L8 12"/><path d="M11.500 7H20M11.500 14H20M11.500 20H20M5 20h.01"/></I>;
export const IconQuiz = (p) => <I {...p}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M11 8h5.500M11 15h5.500"/><A d="M7 8.200l1 1 1.800-2M7 15.200l1 1 1.800-2"/></I>;
export const IconBell = (p) => <I {...p}><path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 2h-15z"/><A d="M10 20.500a2 2 0 0 0 4 0"/></I>;
export const IconAlert = (p) => <I {...p}><path d="M12 4l9 16H3z"/><A d="M12 10v4.500M12 17.300h.01"/></I>;
export const IconHourglass = (p) => <I {...p}><path d="M7 3.500h10M7 20.500h10M8 3.500c0 4.500 8 4.500 8 8.500s-8 4-8 8.500M16 3.500c0 4.500-8 4.500-8 8.500s8 4 8 8.500"/><A d="M10 18.500h4"/></I>;
export const IconCopy = (p) => <I {...p}><rect x="8.500" y="8.500" width="12" height="12" rx="2"/><A d="M15.500 5.500V5A1.500 1.500 0 0 0 14 3.500H5A1.500 1.500 0 0 0 3.500 5v9A1.500 1.500 0 0 0 5 15.500h.5"/></I>;
export const IconSearch = (p) => <I {...p}><circle cx="10.5" cy="10.5" r="6.5"/><A d="M15.5 15.5 20 20"/></I>;
