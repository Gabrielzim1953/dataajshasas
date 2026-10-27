// Funções compartilhadas: conexão com o Supabase, login, máscaras e validações.
// Os dados ficam no Supabase. As chaves de acesso estão em config.js.

const CONFIGURADO = typeof SUPABASE_URL === "string" && SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20;
const sb = CONFIGURADO && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

if (!sb) {
  document.addEventListener("DOMContentLoaded", () => {
    const aviso = document.createElement("div");
    aviso.className = "alerta mostrar";
    aviso.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:300;max-width:560px;width:calc(100% - 32px)";
    aviso.innerHTML = CONFIGURADO
      ? "<strong>Sem conexão com o Supabase.</strong> Verifique sua internet e recarregue a página."
      : "<strong>Supabase ainda não configurado.</strong> Abra o arquivo <code>config.js</code> e cole o Project URL e a chave anon do seu projeto.";
    document.body.prepend(aviso);
  });
}

// Mensagens de erro do Supabase em português
function traduzirErro(e) {
  const m = (e?.message || "").toLowerCase();
  if (e?.code === "23505") return "Este CPF já está cadastrado.";
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar. Procure o link na sua caixa de entrada (e no spam).";
  if (m.includes("already registered")) return "Já existe uma conta com este e-mail.";
  if (m.includes("rate limit") || m.includes("security purposes")) return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  if (m.includes("password")) return "Senha recusada pelo servidor: " + e.message;
  if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão com o servidor. Verifique a internet.";
  return e?.message || "Erro inesperado. Tente de novo.";
}

function exigirSupabase() {
  if (!sb) throw new Error("O Supabase não está configurado. Preencha o arquivo config.js.");
}

// ===== Autenticação =====
const Auth = {
  async cadastrar({ nome, email, senha }) {
    exigirSupabase();
    const { data, error } = await sb.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
      options: { data: { nome: nome.trim() } },
    });
    if (error) throw new Error(traduzirErro(error));
    // Com confirmação de e-mail ligada, um e-mail já usado volta sem "identities"
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error("Já existe uma conta com este e-mail.");
    }
    return { precisaConfirmar: !data.session };
  },

  async entrar(email, senha) {
    exigirSupabase();
    const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
    if (error) throw new Error(traduzirErro(error));
  },

  async sair() {
    if (sb) await sb.auth.signOut();
    location.href = "index.html";
  },

  async atual() {
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    const u = data.session?.user;
    return u ? { id: u.id, email: u.email, nome: u.user_metadata?.nome || u.email.split("@")[0] } : null;
  },

  async exigirLogin() {
    const u = await this.atual();
    if (!u) {
      location.replace("index.html");
      throw new Error("Sem login");
    }
    return u;
  },
};

// ===== Máscaras =====
const soDigitos = (v) => (v || "").replace(/\D/g, "");
const Mascara = {
  cpf(v) {
    v = soDigitos(v).slice(0, 11);
    return v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  },
  telefone(v) {
    v = soDigitos(v).slice(0, 11);
    if (v.length <= 10) return v.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    return v.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  },
  cep(v) { return soDigitos(v).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2"); },
};
function aplicarMascara(input, tipo) {
  input.addEventListener("input", () => { input.value = Mascara[tipo](input.value); });
}

// ===== Validações =====
function cpfValido(cpf) {
  cpf = soDigitos(cpf);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let t = 9; t < 11; t++) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(cpf[i]) * (t + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(cpf[t])) return false;
  }
  return true;
}
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

function marcarCampo(input, ok, mensagem) {
  const campo = input.closest(".campo");
  campo.classList.toggle("invalido", !ok);
  if (mensagem) campo.querySelector(".msg-erro").textContent = mensagem;
  return ok;
}

// ===== Interface =====
function ativarVerSenha() {
  document.querySelectorAll(".ver-senha").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      const mostrar = input.type === "password";
      input.type = mostrar ? "text" : "password";
      btn.setAttribute("aria-label", mostrar ? "Esconder senha" : "Mostrar senha");
      btn.innerHTML = mostrar ? ICONES.olhoFechado : ICONES.olho;
    });
  });
}

function toast(texto) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
  el.innerHTML = ICONES.check + "<span></span>";
  el.querySelector("span").textContent = texto;
  el.classList.add("mostrar");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("mostrar"), 2800);
}

const escapar = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const iniciais = (nome) => (nome || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

const ICONES = {
  olho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  olhoFechado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.4 10.4 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 5.1-5.9M9.9 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
};
