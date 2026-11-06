// Agenda simulada, carregada só quando o site roda em localhost.
// Responde como a API real, mas nada sai do computador.

const servicos = {
  'Corte degradê': 45, 'Low fade': 45, 'Mid fade': 45, 'High fade': 45,
  'Contorno desenhado': 15, 'Barba tradicional': 30, 'Pigmentação cabelo e barba': 60,
  'Sobrancelha': 15, 'Luzes (5 cm a 10 cm)': 120, 'Platinado': 180,
  'Freestyle no cabelo': 60, 'Corte jaca': 45, 'Corte executivo': 45,
  'Corte infantil': 45, 'Corte + barba': 60,
};

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const texto = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export async function chamarApi(caminho, corpo) {
  await espera(350 + Math.random() * 300);
  const url = new URL(caminho, 'http://simulada');

  if (url.pathname === '/services') return { services: servicos, enabled: true, advanceDays: 60 };

  if (url.pathname === '/availability') {
    const dia = url.searchParams.get('day');
    const duracao = servicos[url.searchParams.get('service')] || 45;
    const domingo = new Date(dia + 'T12:00:00Z').getUTCDay() === 0;
    const fecha = domingo ? 12 * 60 : 20 * 60;
    const semente = Number(dia.replaceAll('-', '')) % 7;
    const slots = [];
    for (let m = 9 * 60; m + duracao <= fecha; m += 15) {
      // alguns horários "ocupados" para parecer uma agenda real
      if ((m / 15 + semente) % 5 === 0 || (m / 15 + semente) % 7 === 1) continue;
      slots.push(texto(m));
    }
    return { slots, enabled: true, duration: duracao };
  }

  if (url.pathname === '/appointments' && corpo) {
    console.info('[agenda simulada] pedido recebido:', corpo);
    return { id: 427, status: 'confirmed', received: true };
  }

  throw new Error('Rota desconhecida na agenda simulada.');
}
