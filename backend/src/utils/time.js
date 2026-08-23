function horaParaMinutos(hora) {
  const [h, m] = String(hora).split(':').map(Number);
  return h * 60 + m;
}
function minutosParaHora(total) {
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}:00`;
}
module.exports = { horaParaMinutos, minutosParaHora };
