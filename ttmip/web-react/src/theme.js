// Design tokens shared across the TTMIP React UI.
export const T = {
  bg: '#07090D', surface: '#0C1118', panel: '#111923', panel2: '#141F2B',
  border: '#192433', border2: '#1F3044',
  accent: '#E8873A', accent2: '#F4A233', accent3: '#FBC05A',
  green: '#1A9E5F', green2: '#22C97A', red: '#D94040', red2: '#FF6060',
  blue: '#2272C3', blue2: '#3A9FE8', purple: '#7B52C8', purple2: '#A07EEF',
  gold2: '#F5C842', teal2: '#1ECFB0',
  camGreen: '#007A5E', camRed: '#CE1126', camYellow: '#FCD116',
  text: '#D6E4F0', text2: '#6A91B0', text3: '#2E4A62',
};

export const inputStyle = {
  background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 5,
  color: T.text, fontSize: 10.5, padding: '4px 8px', outline: 'none',
};
