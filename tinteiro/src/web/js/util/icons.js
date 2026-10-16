// Ícones da interface (Lucide, licença ISC).
import {
  createElement, Folder, FolderOpen, FolderPlus, FolderClosed, File, FileText, FileSpreadsheet, FileImage, FileCode, FileType, FilePlus, FileSearch,
  Search, Bookmark, Settings, CircleHelp, ChevronDown, ChevronRight, ChevronLeft, ChevronsUpDown, ChevronsDownUp, ChevronsUpDown as ChevronsExpand,
  ArrowLeft, ArrowRight, ArrowUpNarrowWide, Plus, X, PanelLeft, PanelRight, PanelLeftClose, PanelRightClose, SquareTerminal, SquarePen, Pencil,
  BookOpen, EllipsisVertical, Ellipsis, Trash2, Copy, Columns2, Rows2, ExternalLink, History, RotateCcw, RotateCw, Save, Smartphone, RefreshCw,
  Download, Upload, Sun, Moon, Monitor, Check, CircleCheck, CircleAlert, Info, ListTree, List, ListOrdered, ListChecks, Bold, Italic, Underline,
  Strikethrough, Link, Image, Table, Code, Quote, Heading1, Heading2, Heading3, Undo2, Redo2, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Highlighter, Type, PenTool, Signature, Eraser, ZoomIn, ZoomOut, Maximize, Minimize, Printer, Files, LayoutGrid, Merge, Scissors, MousePointer2,
  Square, Hand, Baseline, Palette, Sigma, Rows3, Columns3, Indent, Outdent, Menu, House, Star, StarOff, Clock, FolderInput, QrCode, Wifi, WifiOff,
  Cloud, CloudOff, Lock, Globe, Paintbrush, MessageSquare, StickyNote, Minus, Eye, EyeOff, Replace, CornerDownLeft, Sparkles, Keyboard, ArrowUp, ArrowDown, Camera,
  SquareCheck, Grip, Inbox, RectangleHorizontal, FileDown, Strikethrough as Strike, Calendar, Hash, Percent, DollarSign, PaintBucket, WrapText,
} from "lucide";

const MAPA = {
  folder: Folder, "folder-open": FolderOpen, "folder-plus": FolderPlus, "folder-closed": FolderClosed, file: File, "file-text": FileText,
  "file-spreadsheet": FileSpreadsheet, "file-image": FileImage, "file-code": FileCode, "file-type": FileType, "file-plus": FilePlus, "file-search": FileSearch,
  search: Search, bookmark: Bookmark, settings: Settings, help: CircleHelp, "chevron-down": ChevronDown, "chevron-right": ChevronRight, "chevron-left": ChevronLeft,
  "chevrons-up-down": ChevronsUpDown, "chevrons-down-up": ChevronsDownUp, "chevrons-expand": ChevronsExpand, "arrow-left": ArrowLeft, "arrow-right": ArrowRight,
  "sort": ArrowUpNarrowWide, plus: Plus, x: X, "sidebar-left": PanelLeft, "sidebar-right": PanelRight, "sidebar-left-close": PanelLeftClose, "sidebar-right-close": PanelRightClose,
  terminal: SquareTerminal, "new-note": SquarePen, pencil: Pencil, "book-open": BookOpen, "more-vertical": EllipsisVertical, "more-horizontal": Ellipsis,
  trash: Trash2, copy: Copy, "split-right": Columns2, "split-down": Rows2, "external-link": ExternalLink, history: History, "rotate-ccw": RotateCcw, "rotate-cw": RotateCw,
  save: Save, smartphone: Smartphone, refresh: RefreshCw, download: Download, upload: Upload, sun: Sun, moon: Moon, monitor: Monitor, check: Check,
  "check-circle": CircleCheck, "alert-circle": CircleAlert, info: Info, outline: ListTree, list: List, "list-ordered": ListOrdered, "list-checks": ListChecks,
  bold: Bold, italic: Italic, underline: Underline, strikethrough: Strikethrough, link: Link, image: Image, table: Table, code: Code, quote: Quote,
  h1: Heading1, h2: Heading2, h3: Heading3, undo: Undo2, redo: Redo2, "align-left": AlignLeft, "align-center": AlignCenter, "align-right": AlignRight,
  "align-justify": AlignJustify, highlighter: Highlighter, type: Type, pen: PenTool, signature: Signature, eraser: Eraser, "zoom-in": ZoomIn, "zoom-out": ZoomOut,
  maximize: Maximize, minimize: Minimize, printer: Printer, files: Files, grid: LayoutGrid, merge: Merge, scissors: Scissors, pointer: MousePointer2,
  square: Square, hand: Hand, baseline: Baseline, palette: Palette, sigma: Sigma, rows: Rows3, columns: Columns3, indent: Indent, outdent: Outdent, menu: Menu,
  home: House, star: Star, "star-off": StarOff, clock: Clock, "folder-input": FolderInput, qr: QrCode, wifi: Wifi, "wifi-off": WifiOff, cloud: Cloud,
  "cloud-off": CloudOff, lock: Lock, globe: Globe, brush: Paintbrush, comment: MessageSquare, note: StickyNote, minus: Minus, eye: Eye, "eye-off": EyeOff,
  replace: Replace, enter: CornerDownLeft, sparkles: Sparkles, keyboard: Keyboard, "arrow-up": ArrowUp, "arrow-down": ArrowDown, camera: Camera,
  "check-square": SquareCheck, grip: Grip, inbox: Inbox, rect: RectangleHorizontal, "file-down": FileDown, strike: Strike, calendar: Calendar, hash: Hash,
  percent: Percent, dollar: DollarSign, "paint-bucket": PaintBucket, wrap: WrapText,
};

/** devolve um <svg class="svg-icon"> */
export function icon(nome, extraClasse = "") {
  const no = MAPA[nome] || File;
  const el = createElement(no, { width: "24", height: "24", "stroke-width": "2" });
  el.setAttribute("class", `svg-icon lucide-${nome}${extraClasse ? " " + extraClasse : ""}`);
  el.removeAttribute("width"); el.removeAttribute("height");
  el.setAttribute("aria-hidden", "true");
  return el;
}

/** botão de ícone clicável, com dica */
export function iconButton(nome, titulo, onClick, classe = "clickable-icon") {
  const b = document.createElement("div");
  b.className = classe;
  b.setAttribute("aria-label", titulo || "");
  if (titulo) b.title = titulo;
  b.setAttribute("role", "button");
  b.tabIndex = -1;
  b.appendChild(icon(nome));
  if (onClick) b.addEventListener("click", e => { e.stopPropagation(); onClick(e); });
  return b;
}

/** ícone por tipo de arquivo */
export function iconeDoArquivo(ext) {
  if (["md", "markdown", "txt"].includes(ext)) return "file-text";
  if (["docx", "doc", "odt", "rtf"].includes(ext)) return "file-type";
  if (["xlsx", "xls", "csv", "ods", "tsv"].includes(ext)) return "file-spreadsheet";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return "file-image";
  if (["html", "htm", "json", "js", "css", "xml"].includes(ext)) return "file-code";
  if (ext === "pdf") return "file-text";
  return "file";
}
