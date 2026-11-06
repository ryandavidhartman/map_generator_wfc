import type { RoomType } from './dungeonTables'

export const ROOM_TYPE_COLORS: Record<RoomType, string> = {
  Empty: '#3a3a3a',
  Trap: '#b45309',
  'Minor Hazard': '#ca8a04',
  'Solo Monster': '#b91c1c',
  NPC: '#4a90c4',
  'Monster Mob': '#7c2d12',
  'Major Hazard': '#dc2626',
  Treasure: '#d4af37',
  'Boss Monster': '#7f1d1d',
}
