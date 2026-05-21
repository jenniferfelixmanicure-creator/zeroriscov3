import { Router, type Request, type Response, type NextFunction } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@workspace/db";
import { usersTable, driverProfilesTable, ridesTable } from "@workspace/db";
import path from "path";
import fs from "fs";

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const pwd = req.headers["x-admin-password"] ?? req.query["pwd"];
  if (pwd !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Não autorizado" });
    return;
  }
  next();
}

router.get("/admin/panel", (_req, res): void => {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>ZeroRisco Admin</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#060D1A;color:#E4F0FF;font-family:system-ui,sans-serif;min-height:100vh}
  .header{background:#0A1628;border-bottom:1px solid #1A3050;padding:16px 24px;display:flex;align-items:center;gap:12px}
  .brand{font-size:22px;font-weight:700;color:#00C8FF;letter-spacing:1px}
  .badge{background:#00C8FF22;color:#00C8FF;border:1px solid #00C8FF44;border-radius:6px;padding:2px 10px;font-size:12px;font-weight:600}
  .login-wrap{display:flex;align-items:center;justify-content:center;height:80vh}
  .login-box{background:#0A1628;border:1px solid #1A3050;border-radius:16px;padding:32px;width:340px;display:flex;flex-direction:column;gap:16px}
  .login-title{font-size:20px;font-weight:700;color:#E4F0FF;text-align:center}
  input{background:#060D1A;border:1px solid #1A3050;border-radius:10px;color:#E4F0FF;font-size:15px;padding:12px 16px;width:100%;outline:none}
  input:focus{border-color:#00C8FF}
  .btn{background:linear-gradient(90deg,#00C8FF,#0066EE);border:none;border-radius:10px;color:#fff;cursor:pointer;font-size:15px;font-weight:700;padding:14px;width:100%;transition:opacity .2s}
  .btn:hover{opacity:.85}
  .btn-danger{background:linear-gradient(90deg,#FF3A6E,#CC0040)}
  .btn-success{background:linear-gradient(90deg,#00FFD4,#00AA88)}
  .btn-sm{padding:8px 16px;font-size:13px;width:auto;border-radius:8px}
  .main{padding:24px;max-width:1100px;margin:0 auto}
  .section-title{font-size:18px;font-weight:700;color:#E4F0FF;margin-bottom:16px}
  .tabs{display:flex;gap:8px;margin-bottom:24px}
  .tab{background:#0A1628;border:1px solid #1A3050;border-radius:8px;color:#4E7090;cursor:pointer;padding:8px 20px;font-size:14px;font-weight:600;transition:all .2s}
  .tab.active{border-color:#00C8FF;color:#00C8FF;background:#00C8FF11}
  .cards{display:grid;gap:16px}
  .card{background:#0A1628;border:1px solid #1A3050;border-radius:16px;padding:20px}
  .card-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
  .driver-name{font-size:17px;font-weight:700;color:#E4F0FF}
  .driver-cpf{font-size:13px;color:#4E7090;margin-top:2px}
  .status{border-radius:6px;font-size:12px;font-weight:700;padding:3px 10px}
  .status-pending{background:#FF950022;color:#FF9500;border:1px solid #FF950044}
  .status-approved{background:#00FFD422;color:#00FFD4;border:1px solid #00FFD444}
  .status-rejected{background:#FF3A6E22;color:#FF3A6E;border:1px solid #FF3A6E44}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
  .info-item label{font-size:11px;color:#4E7090;display:block;margin-bottom:2px}
  .info-item span{font-size:14px;color:#E4F0FF;font-weight:500}
  .docs{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}
  .doc-img{border:1px solid #1A3050;border-radius:10px;cursor:pointer;height:120px;object-fit:cover;width:180px;background:#060D1A}
  .doc-label{font-size:11px;color:#4E7090;margin-top:4px;text-align:center}
  .actions{display:flex;gap:10px;flex-wrap:wrap}
  .empty{color:#4E7090;text-align:center;padding:40px;font-size:15px}
  .toast{position:fixed;bottom:24px;right:24px;background:#0A1628;border:1px solid #00C8FF;border-radius:12px;color:#00C8FF;font-size:14px;font-weight:600;padding:14px 20px;z-index:9999;display:none}
  .reject-input{background:#060D1A;border:1px solid #FF3A6E44;border-radius:8px;color:#E4F0FF;font-size:13px;padding:8px 12px;width:100%;margin-top:8px;outline:none}
  .modal-overlay{display:none;position:fixed;inset:0;background:#00000099;z-index:100;align-items:center;justify-content:center}
  .modal-overlay.open{display:flex}
  .modal{background:#0A1628;border:1px solid #1A3050;border-radius:16px;max-width:92vw;max-height:90vh;overflow:auto}
  .modal img{max-width:80vw;max-height:80vh;display:block}
</style>
</head>
<body>
<div class="header">
  <span class="brand">ZeroRisco</span>
  <span class="badge">Admin</span>
</div>

<div class="login-wrap" id="loginWrap">
  <div class="login-box">
    <div class="login-title">Painel Administrativo</div>
    <input id="pwdInput" type="password" placeholder="Senha do admin" onkeydown="if(event.key==='Enter')doLogin()"/>
    <button class="btn" onclick="doLogin()">Entrar</button>
    <div id="loginErr" style="color:#FF3A6E;font-size:13px;text-align:center;display:none">Senha incorreta</div>
  </div>
</div>

<div class="main" id="mainPanel" style="display:none">
  <div class="tabs">
    <div class="tab active" onclick="loadTab('pending',this)">Pendentes</div>
    <div class="tab" onclick="loadTab('approved',this)">Aprovados</div>
    <div class="tab" onclick="loadTab('rejected',this)">Rejeitados</div>
    <div class="tab" onclick="loadTab('rides',this)">Corridas</div>
    <div class="tab" onclick="loadTab('finance',this)">Financeiro</div>
  </div>
  <div id="content"><div class="empty">Carregando...</div></div>
</div>

<div class="modal-overlay" id="imgModal" onclick="closeModal()">
  <div class="modal"><img id="modalImg" src=""/></div>
</div>

<div class="toast" id="toast"></div>

<script>
let pwd = "";

function doLogin() {
  const errEl = document.getElementById("loginErr");
  const btn = document.querySelector(".login-box .btn");
  pwd = document.getElementById("pwdInput").value;
  if (!pwd) { errEl.textContent = "Digite a senha."; errEl.style.display = "block"; return; }
  errEl.style.display = "none";
  if (btn) btn.textContent = "Entrando...";
  fetch("/api/admin/drivers?status=pending", { headers: { "x-admin-password": pwd } })
    .then(r => {
      if (btn) btn.textContent = "Entrar";
      if (r.status === 401) {
        errEl.textContent = "Senha incorreta. Verifique a variável ADMIN_PASSWORD no servidor.";
        errEl.style.display = "block";
        return;
      }
      if (!r.ok) {
        errEl.textContent = "Erro no servidor (" + r.status + "). Tente novamente.";
        errEl.style.display = "block";
        return;
      }
      document.getElementById("loginWrap").style.display = "none";
      document.getElementById("mainPanel").style.display = "block";
      loadTab("pending");
    })
    .catch(err => {
      if (btn) btn.textContent = "Entrar";
      errEl.textContent = "Falha de conexão com o servidor. Verifique se o backend está online.";
      errEl.style.display = "block";
    });
}

function loadTab(status, el) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  if (el) el.classList.add("active");
  
  const contentEl = document.getElementById("content");
  contentEl.innerHTML = '<div class="empty">Carregando...</div>';

  if (status === 'rides') {
    fetch("/api/admin/rides", { headers: { "x-admin-password": pwd } })
      .then(r => r.json())
      .then(data => renderRides(data.rides ?? []));
    return;
  }

  if (status === 'finance') {
    fetch("/api/admin/finance", { headers: { "x-admin-password": pwd } })
      .then(r => r.json())
      .then(data => renderFinance(data));
    return;
  }

  fetch("/api/admin/drivers?status=" + status, { headers: { "x-admin-password": pwd } })
    .then(r => r.json())
    .then(data => renderCards(data.drivers ?? [], status));
}

function renderRides(rides) {
  const el = document.getElementById("content");
  if (!rides.length) { el.innerHTML = '<div class="empty">Nenhuma corrida encontrada</div>'; return; }
  let html = '<div class="cards">';
  for (const r of rides) {
    html += '<div class="card">' +
      '<div class="card-header">' +
        '<div>' +
          '<div class="driver-name">#' + r.id + ' - ' + r.passengerName + '</div>' +
          '<div class="driver-cpf">' + new Date(r.createdAt).toLocaleString("pt-BR") + '</div>' +
        '</div>' +
        '<span class="status status-' + r.status + '">' + r.status + '</span>' +
      '</div>' +
      '<div class="info-grid">' +
        '<div class="info-item"><label>Origem</label><span>' + r.originAddress + '</span></div>' +
        '<div class="info-item"><label>Destino</label><span>' + r.destinationAddress + '</span></div>' +
        '<div class="info-item"><label>Motorista</label><span>' + (r.driverName || "Não atribuído") + '</span></div>' +
        '<div class="info-item"><label>Valor</label><span style="color:#00FFD4">R$ ' + r.estimatedFare + '</span></div>' +
      '</div>' +
    '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function renderFinance(data) {
  const el = document.getElementById("content");
  el.innerHTML = '<div class="info-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 24px;">' +
      '<div class="card" style="text-align:center"><label style="color:#4E7090;font-size:12px">Total em Corridas</label><div style="font-size:24px;font-weight:700;color:#00FFD4;margin-top:8px">R$ ' + (data.totalVolume || '0,00') + '</div></div>' +
      '<div class="card" style="text-align:center"><label style="color:#4E7090;font-size:12px">Comissão App (15%)</label><div style="font-size:24px;font-weight:700;color:#00C8FF;margin-top:8px">R$ ' + (data.totalCommission || '0,00') + '</div></div>' +
      '<div class="card" style="text-align:center"><label style="color:#4E7090;font-size:12px">Saldo Motoristas</label><div style="font-size:24px;font-weight:700;color:#FFB800;margin-top:8px">R$ ' + (data.totalDriverBalance || '0,00') + '</div></div>' +
    '</div>' +
    '<div class="section-title">Últimos Pagamentos</div>' +
    '<div class="empty">Módulo de pagamentos em integração...</div>';
}

function renderCards(drivers, status) {
  const el = document.getElementById("content");
  if (!drivers.length) { el.innerHTML = '<div class="empty">Nenhum motorista ' + (status === "pending" ? "pendente" : status === "approved" ? "aprovado" : "rejeitado") + '</div>'; return; }
  el.innerHTML = '<div class="cards">' + drivers.map(d => card(d, status)).join("") + '</div>';
}

function card(d, status) {
  const st = status === "pending" ? "pending" : status === "approved" ? "approved" : "rejected";
  const stLabel = status === "pending" ? "Pendente" : status === "approved" ? "Aprovado" : "Rejeitado";
  
  let actionsHtml = "";
  if (status === "pending") {
    actionsHtml = '<div class="actions">' +
      '<button class="btn btn-success btn-sm" onclick="approve(' + d.driverId + ')">Aprovar</button>' +
      '<div style="flex:1">' +
        '<button class="btn btn-danger btn-sm" onclick="toggleReject(' + d.driverId + ')">Rejeitar</button>' +
        '<input class="reject-input" id="reason-' + d.driverId + '" placeholder="Motivo da rejeição (obrigatório)" style="display:none"/>' +
        '<button class="btn btn-danger btn-sm" id="confirmReject-' + d.driverId + '" style="display:none;margin-top:8px" onclick="reject(' + d.driverId + ')">Confirmar rejeição</button>' +
      '</div>' +
    '</div>';
  }

  return '<div class="card" id="card-' + d.driverId + '">' +
    '<div class="card-header">' +
      '<div><div class="driver-name">' + d.name + '</div><div class="driver-cpf">CPF: ' + fmtCpf(d.cpf) + '</div></div>' +
      '<span class="status status-' + st + '">' + stLabel + '</span>' +
    '</div>' +
    '<div class="info-grid">' +
      '<div class="info-item"><label>Telefone</label><span>' + (d.phone || "-") + '</span></div>' +
      '<div class="info-item"><label>Cadastro</label><span>' + new Date(d.createdAt).toLocaleDateString("pt-BR") + '</span></div>' +
      '<div class="info-item"><label>Veículo</label><span>' + (d.vehicleModel || "-") + '</span></div>' +
      '<div class="info-item"><label>Placa</label><span>' + (d.vehiclePlate || "-") + '</span></div>' +
    '</div>' +
    '<div class="docs">' +
      (d.cnhUrl ? '<div><img class="doc-img" src="' + d.cnhUrl + '" onclick="openModal(\'' + d.cnhUrl + '\')"/><div class="doc-label">CNH</div></div>' : '<div style="color:#4E7090;font-size:12px">CNH não enviada</div>') +
      (d.crlvUrl ? '<div><img class="doc-img" src="' + d.crlvUrl + '" onclick="openModal(\'' + d.crlvUrl + '\')"/><div class="doc-label">CRLV</div></div>' : '<div style="color:#4E7090;font-size:12px">CRLV não enviado</div>') +
    '</div>' +
    actionsHtml +
  '</div>';
}

function fmtCpf(c) {
  if (!c) return "-";
  return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function approve(id) {
  fetch("/api/admin/drivers/" + id + "/approve", { method: "PUT", headers: { "x-admin-password": pwd } })
    .then(r => r.json()).then(d => {
      if (d.success) { showToast("Motorista aprovado!"); loadTab("pending"); }
    });
}

function toggleReject(id) {
  const r = document.getElementById("reason-" + id);
  const b = document.getElementById("confirmReject-" + id);
  r.style.display = r.style.display === "none" ? "block" : "none";
  b.style.display = b.style.display === "none" ? "block" : "none";
}

function reject(id) {
  const reason = document.getElementById("reason-" + id).value.trim();
  if (!reason) { alert("Informe o motivo da rejeição"); return; }
  fetch("/api/admin/drivers/" + id + "/reject", {
    method: "PUT",
    headers: { "x-admin-password": pwd, "Content-Type": "application/json" },
    body: JSON.stringify({ reason })
  }).then(r => r.json()).then(d => {
    if (d.success) { showToast("Motorista rejeitado."); loadTab("pending"); }
  });
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.style.display = "block";
  setTimeout(() => t.style.display = "none", 3000);
}

function openModal(src) {
  document.getElementById("modalImg").src = src;
  document.getElementById("imgModal").classList.add("open");
}
function closeModal() { document.getElementById("imgModal").classList.remove("open"); }
</script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

router.get("/admin/drivers", requireAdmin, async (req, res): Promise<void> => {
  const status = (req.query["status"] as string) ?? "pending";
  const rows = await db
    .select({
      driverId: driverProfilesTable.id,
      userId: usersTable.id,
      name: usersTable.name,
      cpf: usersTable.cpf,
      phone: usersTable.phone,
      createdAt: usersTable.createdAt,
      vehicleModel: driverProfilesTable.vehicleModel,
      vehiclePlate: driverProfilesTable.vehiclePlate,
      approvalStatus: driverProfilesTable.approvalStatus,
      cnhUrl: driverProfilesTable.cnhUrl,
      crlvUrl: driverProfilesTable.crlvUrl,
      rejectionReason: driverProfilesTable.rejectionReason,
    })
    .from(driverProfilesTable)
    .innerJoin(usersTable, eq(driverProfilesTable.userId, usersTable.id))
    .where(eq(driverProfilesTable.approvalStatus, status));

  res.json({ drivers: rows });
});

router.put("/admin/drivers/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  await db
    .update(driverProfilesTable)
    .set({ approvalStatus: "approved", rejectionReason: null })
    .where(eq(driverProfilesTable.id, id));
  res.json({ success: true });
});

router.put("/admin/drivers/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { reason } = req.body as { reason?: string };
  if (!reason) {
    res.status(400).json({ error: "Motivo obrigatório" });
    return;
  }
  await db
    .update(driverProfilesTable)
    .set({ approvalStatus: "rejected", rejectionReason: reason })
    .where(eq(driverProfilesTable.id, id));
  res.json({ success: true });
});

router.get("/admin/rides", requireAdmin, async (req, res): Promise<void> => {
  const passenger = alias(usersTable, "passenger");
  const driver = alias(usersTable, "driver");

  const rides = await db
    .select({
      id: ridesTable.id,
      status: ridesTable.status,
      originAddress: ridesTable.originAddress,
      destinationAddress: ridesTable.destinationAddress,
      estimatedFare: ridesTable.estimatedFare,
      createdAt: ridesTable.createdAt,
      passengerName: passenger.name,
      driverName: driver.name,
    })
    .from(ridesTable)
    .innerJoin(passenger, eq(ridesTable.passengerId, passenger.id))
    .leftJoin(driver, eq(ridesTable.driverId, driver.id))
    .orderBy(desc(ridesTable.createdAt))
    .limit(50);

  res.json({ rides });
});

router.get("/admin/finance", requireAdmin, async (req, res): Promise<void> => {
  const [stats] = await db
    .select({
      totalVolume: sql<string>`COALESCE(SUM(CAST(estimated_fare AS NUMERIC)), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(ridesTable)
    .where(eq(ridesTable.status, "completed"));

  const [driverStats] = await db
    .select({
      totalBalance: sql<string>`COALESCE(SUM(CAST(balance AS NUMERIC)), 0)`,
    })
    .from(driverProfilesTable);

  const totalVolume = parseFloat(stats?.totalVolume || "0");
  const commission = totalVolume * 0.15;

  res.json({
    totalVolume: totalVolume.toFixed(2).replace(".", ","),
    totalCommission: commission.toFixed(2).replace(".", ","),
    totalDriverBalance: parseFloat(driverStats?.totalBalance || "0").toFixed(2).replace(".", ","),
    rideCount: stats?.count || 0,
  });
});

export default router;
