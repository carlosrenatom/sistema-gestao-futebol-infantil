// Sistema de Apoio e Organização do Futebol Infantil
// Funcionalidades: CRUD atletas, treinos, presenças, comunicados, gráficos e exportação.
// Usa localStorage para persistência simples (substituir por backend real quando disponível).

const STORAGE_KEYS = { ATLETAS: 'fut_atletas_v1', TREINOS: 'fut_treinos_v1', PRESENCAS: 'fut_presencas_v1', COMUNICADOS: 'fut_comunicados_v1' };

// Util helpers
const $ = (s, ctx=document) => ctx.querySelector(s);
const $$ = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

function read(key){ return JSON.parse(localStorage.getItem(key) || '[]'); }
function write(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

// Init sample data if empty
if(!read(STORAGE_KEYS.ATLETAS).length){
  write(STORAGE_KEYS.ATLETAS,[
    {id:uid(), nome:'João Silva', idade:10, turma:'A', responsavel:'Maria Silva'},
    {id:uid(), nome:'Luana Pereira', idade:9, turma:'A', responsavel:'Carlos Pereira'},
    {id:uid(), nome:'Pedro Costa', idade:11, turma:'B', responsavel:'Ana Costa'}
  ]);
}
if(!read(STORAGE_KEYS.TREINOS).length){
  write(STORAGE_KEYS.TREINOS,[
    {id:uid(),titulo:'Treino técnico',data:new Date().toISOString().slice(0,10),hora:'15:00',turma:'A'},
    {id:uid(),titulo:'Jogo amistoso',data:new Date(Date.now()+86400000).toISOString().slice(0,10),hora:'09:00',turma:'B'}
  ]);
}

// State
let currentView='dashboard';
let chartFreq=null;

// DOM elements
const navBtns = $$('.nav-btn');
const views = $$('.view');
const tableAtletasBody = $('#tableAtletas tbody');
const totalAtletasEl = $('#totalAtletas');
const totalTreinosEl = $('#totalTreinos');
const presencaHojeEl = $('#presencaHoje');
const proximosTreinosEl = $('#proximosTreinos');
const ultimosComunicadosEl = $('#ultimosComunicados');
const btnNewAthlete = $('#btnNewAthlete');
const modal = $('#modal');
const closeModal = $('#closeModal');
const formAtleta = $('#formAtleta');
const btnExportCSV = $('#btnExportCSV');
const searchInput = $('#searchInput');

// Navigation
navBtns.forEach(b=>b.addEventListener('click', ()=>{ navBtns.forEach(x=>x.classList.remove('active')); b.classList.add('active'); showView(b.dataset.view); }));
function showView(view){
  currentView=view;
  views.forEach(v=>v.classList.remove('active'));
  $(`#view-${view}`).classList.add('active');
  if(view==='dashboard') renderDashboard();
  if(view==='atletas') renderAtletas();
  if(view==='treinos') renderTreinos();
  if(view==='presenca') renderPresenca();
  if(view==='comunicados') renderComunicados();
  if(view==='relatorios') renderRelatorio();
}

// Modal new athlete
btnNewAthlete.addEventListener('click', ()=>{ modal.classList.remove('hidden'); $('#modalTitle').textContent='Novo Atleta'; formAtleta.reset(); });
closeModal.addEventListener('click', ()=> modal.classList.add('hidden'));

// Form Atleta submit
formAtleta.addEventListener('submit', e=>{
  e.preventDefault();
  const fd = new FormData(formAtleta);
  const atleta = { id: uid(), nome: fd.get('nome'), idade: Number(fd.get('idade')), turma: fd.get('turma'), responsavel: fd.get('responsavel') };
  const atletas = read(STORAGE_KEYS.ATLETAS);
  atletas.push(atleta); write(STORAGE_KEYS.ATLETAS, atletas);
  modal.classList.add('hidden');
  if(currentView==='atletas') renderAtletas();
  renderDashboard();
});

// Render atletas table
function renderAtletas(filter=''){
  const atletas = read(STORAGE_KEYS.ATLETAS).filter(a=> (a.nome+''+a.turma+''+a.responsavel).toLowerCase().includes(filter.toLowerCase()));
  tableAtletasBody.innerHTML='';
  atletas.forEach(a=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${a.nome}</td><td>${a.idade}</td><td>${a.turma}</td><td>${a.responsavel}</td>
      <td><button class="edit" data-id="${a.id}">Editar</button> <button class="del" data-id="${a.id}">Excluir</button></td>`;
    tableAtletasBody.appendChild(tr);
  });
  // attach handlers
  $$('.edit', tableAtletasBody).forEach(btn=>btn.addEventListener('click', ()=> editAtleta(btn.dataset.id)));
  $$('.del', tableAtletasBody).forEach(btn=>btn.addEventListener('click', ()=> deleteAtleta(btn.dataset.id)));
  totalAtletasEl.textContent = read(STORAGE_KEYS.ATLETAS).length;
}

// Edit / delete
function editAtleta(id){
  const atletas = read(STORAGE_KEYS.ATLETAS);
  const a = atletas.find(x=>x.id===id);
  if(!a) return alert('Atleta não encontrado');
  modal.classList.remove('hidden');
  $('#modalTitle').textContent='Editar Atleta';
  formAtleta.nome.value = a.nome;
  formAtleta.idade.value = a.idade;
  formAtleta.turma.value = a.turma;
  formAtleta.responsavel.value = a.responsavel;
  // On save (override submit listener)
  const onSave = (e)=>{
    e.preventDefault();
    a.nome = formAtleta.nome.value; a.idade = Number(formAtleta.idade.value); a.turma = formAtleta.turma.value; a.responsavel = formAtleta.responsavel.value;
    write(STORAGE_KEYS.ATLETAS, atletas);
    modal.classList.add('hidden');
    formAtleta.removeEventListener('submit', onSave);
    formAtleta.addEventListener('submit', defaultAtletaSubmit);
    renderAtletas();
    renderDashboard();
  };
  // swap handler
  formAtleta.removeEventListener('submit', defaultAtletaSubmit);
  formAtleta.addEventListener('submit', onSave);
  function defaultAtletaSubmit(e){}
}

// Delete
function deleteAtleta(id){
  if(!confirm('Excluir atleta?')) return;
  let atletas = read(STORAGE_KEYS.ATLETAS);
  atletas = atletas.filter(a=>a.id!==id);
  write(STORAGE_KEYS.ATLETAS, atletas);
  renderAtletas(); renderDashboard();
}

// Treinos
const formTreino = $('#formTreino');
formTreino.addEventListener('submit', e=>{
  e.preventDefault();
  const fd = new FormData(formTreino);
  const treino = { id: uid(), titulo: fd.get('titulo'), data: fd.get('data'), hora: fd.get('hora'), turma: fd.get('turma') };
  const treinos = read(STORAGE_KEYS.TREINOS);
  treinos.push(treino); write(STORAGE_KEYS.TREINOS, treinos);
  formTreino.reset();
  renderTreinos(); renderDashboard();
});
function renderTreinos(){
  const treinos = read(STORAGE_KEYS.TREINOS);
  $('#listaTreinos').innerHTML = treinos.map(t=>`<li>${t.data} ${t.hora} — <strong>${t.titulo}</strong> (Turma ${t.turma})</li>`).join('');
  totalTreinosEl.textContent = treinos.length;
}

// Presença
$('#btnLoadAtletas').addEventListener('click', ()=>{
  const data = $('#presencaData').value || new Date().toISOString().slice(0,10);
  const turma = $('#presencaTurma').value;
  const atletas = read(STORAGE_KEYS.ATLETAS).filter(a=>a.turma===turma);
  $('#presencaList').innerHTML = atletas.map(a=>`<div class="presenca-card"><div>${a.nome} <small>${a.responsavel}</small></div><div><label><input type="checkbox" data-id="${a.id}" checked /> Presente</label></div></div>`).join('');
});
$('#btnSavePresenca').addEventListener('click', ()=>{
  const data = $('#presencaData').value || new Date().toISOString().slice(0,10);
  const turma = $('#presencaTurma').value;
  const checkboxes = Array.from($('#presencaList').querySelectorAll('input[type="checkbox"]'));
  const presencas = checkboxes.map(cb=>({ id: cb.dataset.id, presente: cb.checked }));
  const store = read(STORAGE_KEYS.PRESENCAS);
  store.push({ id: uid(), data, turma, presencas });
  write(STORAGE_KEYS.PRESENCAS, store);
  alert('Presença salva');
  renderDashboard();
});

// Comunicados
$('#formComunicado').addEventListener('submit', e=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const comunicado = { id: uid(), titulo: fd.get('titulo'), mensagem: fd.get('mensagem'), data: new Date().toISOString() };
  const list = read(STORAGE_KEYS.COMUNICADOS); list.unshift(comunicado); write(STORAGE_KEYS.COMUNICADOS, list);
  e.target.reset(); renderComunicados(); renderDashboard();
});
function renderComunicados(){
  const comms = read(STORAGE_KEYS.COMUNICADOS);
  $('#listaComunicados').innerHTML = comms.map(c=>`<li><strong>${new Date(c.data).toLocaleDateString()}</strong> — ${c.titulo}<br/><small>${c.mensagem}</small></li>`).join('');
  ultimosComunicadosEl.innerHTML = comms.slice(0,3).map(c=>`<li>${c.titulo}</li>`).join('') || '<li>Sem comunicados</li>';
}

// Dashboard render and charts
function renderDashboard(){
  const atletas = read(STORAGE_KEYS.ATLETAS);
  const treinos = read(STORAGE_KEYS.TREINOS);
  const presencas = read(STORAGE_KEYS.PRESENCAS);
  totalAtletasEl.textContent = atletas.length;
  totalTreinosEl.textContent = treinos.length;
  const last = presencas[presencas.length-1];
  if(last){
    const presCount = last.presencas.filter(p=>p.presente).length;
    presencaHojeEl.textContent = Math.round((presCount/last.presencas.length)*100) + '%';
  } else presencaHojeEl.textContent = '—';
  proximosTreinosEl.innerHTML = treinos.slice(0,5).map(t=>`<li>${t.data} ${t.hora} — ${t.titulo} (Turma ${t.turma})</li>`).join('') || '<li>Sem treinos</li>';
  // chart
  const freqByTurma = {};
  presencas.forEach(s=>{
    s.presencas.forEach(p=>{
      const atleta = read(STORAGE_KEYS.ATLETAS).find(a=>a.id===p.id);
      const turma = atleta ? atleta.turma : '—';
      if(!freqByTurma[turma]) freqByTurma[turma]=[];
      freqByTurma[turma].push(p.presente?1:0);
    });
  });
  const labels = Object.keys(freqByTurma);
  const data = labels.map(t=> Math.round((freqByTurma[t].reduce((a,b)=>a+b,0)/freqByTurma[t].length)*100) );
  if(chartFreq) { chartFreq.data.labels = labels; chartFreq.data.datasets[0].data = data; chartFreq.update(); }
  else {
    const ctx = document.getElementById('chartFreq').getContext('2d');
    chartFreq = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label:'Presença (%)', data, backgroundColor: 'rgba(31,138,55,0.7)'}]},
      options: { responsive:true, maintainAspectRatio:false }
    });
  }
}

// Relatórios
function renderRelatorio(){
  const atletas = read(STORAGE_KEYS.ATLETAS);
  const treinos = read(STORAGE_KEYS.TREINOS);
  const comms = read(STORAGE_KEYS.COMUNICADOS);
  const pres = read(STORAGE_KEYS.PRESENCAS);
  const resumo = `Relatório - Projeto Sistema de Apoio\n\nAtletas cadastrados: ${atletas.length}\nTreinos registrados: ${treinos.length}\nComunicados: ${comms.length}\nRegistros de presença: ${pres.length}\n\nRecomendações: Continuar com ciclos de avaliação mensais e buscar integração com sistema municipal.`;
  $('#relatorioResumo').textContent = resumo;
  $('#btnDownloadRelatorio').onclick = ()=>{
    const blob = new Blob([resumo], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'relatorio_resumido.txt'; a.click(); URL.revokeObjectURL(url);
  };
}

// Export CSV
btnExportCSV.addEventListener('click', ()=>{
  const atletas = read(STORAGE_KEYS.ATLETAS);
  const csv = ['Nome,Idade,Turma,Responsavel', ...atletas.map(a=>`${a.nome},${a.idade},${a.turma},${a.responsavel}`)].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'atletas.csv'; a.click(); URL.revokeObjectURL(url);
});

// Search
searchInput.addEventListener('input', e=>{
  const v = e.target.value;
  if(currentView==='atletas') renderAtletas(v);
});

// initial render
renderAtletas(); renderTreinos(); renderComunicados(); renderDashboard(); renderRelatorio(); showView('dashboard');
