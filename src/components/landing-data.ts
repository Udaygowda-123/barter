export const P = (n: string) => `/demo/${n}.webp`;
export type Photo = { src: string; label: string; value: string };
export const PHOTOS: Photo[] = [
  { src: P('sneakers'), label: 'Retro sneakers', value: '₹4,000' }, { src: P('camera'), label: 'Film camera', value: '₹6,500' },
  { src: P('headphones'), label: 'Headphones', value: '₹3,000' }, { src: P('jacket'), label: 'Denim jacket', value: '₹1,800' },
  { src: P('console'), label: 'Handheld console', value: '₹7,000' }, { src: P('vinyl'), label: 'Sealed vinyl', value: '₹2,500' },
  { src: P('keyboard'), label: 'Mechanical keyboard', value: '₹3,500' }, { src: P('tee'), label: 'Band tee', value: '₹800' },
  { src: P('lamp'), label: 'Desk lamp', value: '₹1,200' }, { src: P('books'), label: 'Paperback set', value: '₹900' },
  { src: P('cards'), label: 'Trading cards', value: '₹5,000' }, { src: P('trail'), label: 'Trail shoes', value: '₹2,200' },
];

