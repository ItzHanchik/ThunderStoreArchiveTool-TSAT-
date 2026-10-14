export interface Manifest { name: string; version_number: string; website_url: string; description: string; dependencies: string[] }
export interface Asset { path: string; data: Uint8Array }
export interface Project {
  id: string; game: string; team: string; manifest: Manifest; readme: string; changelog: string;
  files: Asset[]; icon?: Uint8Array; updatedAt: number; createdAt: number; template?: boolean;
}
export interface BuildRecord { id: string; project: string; version: string; game: string; at: number; size: number; filename: string }
export interface Preferences { theme: 'light' | 'dark'; accent: string; weather: 'none' | 'snow' | 'rain'; density: 'comfortable' | 'compact'; background: string; opacity: number }
export const defaults: Preferences = { theme: 'light', accent: '#247d60', weather: 'none', density: 'comfortable', background: '', opacity: 15 };
export const games = [
  { id: 'valheim', name: 'Valheim', subtitle: 'Мир викингов', art: 'valheim', color: '#d59151', tag: 'Survival' },
  { id: 'lethal-company', name: 'Lethal Company', subtitle: 'Вместе в неизвестность', art: 'lethal', color: '#d87659', tag: 'Co-op' },
  { id: 'riskofrain2', name: 'Risk of Rain 2', subtitle: 'За пределами Петрикора', art: 'risk', color: '#8392d1', tag: 'Roguelike' },
  { id: 'content-warning', name: 'Content Warning', subtitle: 'Снимайте. Выживайте.', art: 'lethal', color: '#e4ad57', tag: 'Co-op' },
  { id: 'baldurs-gate-3', name: 'Baldur’s Gate 3', subtitle: 'Ваша история', art: 'valheim', color: '#c38c59', tag: 'RPG' },
  { id: 'bonelab', name: 'BONELAB', subtitle: 'Новая реальность', art: 'risk', color: '#8aa2bb', tag: 'VR' },
  { id: 'rounds', name: 'ROUNDS', subtitle: 'Ещё один раунд', art: 'risk', color: '#d29d76', tag: 'Action' },
  { id: 'repo', name: 'R.E.P.O.', subtitle: 'Бережная доставка', art: 'lethal', color: '#9b9f86', tag: 'Co-op' },
  { id: 'dyson-sphere-program', name: 'Dyson Sphere Program', subtitle: 'Масштаб вселенной', art: 'risk', color: '#73a0b8', tag: 'Simulation' },
  { id: 'peak', name: 'PEAK', subtitle: 'Только вверх', art: 'valheim', color: '#91a275', tag: 'Adventure' },
];
export const gameInfo = (id: string) => games.find(g => g.id === id) ?? { id, name: id, art: 'risk', color: '#879ac8', tag: 'Custom', subtitle: 'Другое сообщество' };
export function newProject(name: string, game: string, template = false): Project {
  return { id: crypto.randomUUID(), game, team: '', manifest: { name, version_number: '1.0.0', website_url: '', description: '', dependencies: [] }, readme: `# ${name}\n\nОписание вашего мода.\n\n## Установка\n\nУстановите через совместимый менеджер модов.\n\n## Возможности\n\n- Расскажите, что нового добавляет мод.\n`, changelog: '# Changelog\n\n## 1.0.0\n\n- Первый релиз.\n', files: [], updatedAt: Date.now(), createdAt: Date.now(), template };
}
export function starterProjects(): Project[] {
  return [ ['Northern_Lights', 'valheim', 'Новая атмосфера северных приключений.'], ['Company_Extras', 'lethal-company', 'Небольшие улучшения для большой команды.'], ['Beyond_Petrichor', 'riskofrain2', 'Новый взгляд на знакомую планету.'] ].map(([name, game, description]) => ({ ...newProject(name, game, true), manifest: { name, description, version_number: '1.0.0', website_url: '', dependencies: [] } }));
}
export const sizeLabel = (n: number) => n < 1024 ? `${n} Б` : n < 1048576 ? `${(n / 1024).toFixed(1)} КБ` : `${(n / 1048576).toFixed(1)} МБ`;
