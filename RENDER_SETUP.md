# Configuração do Backend no Render - ZeroRisco

Como você já criou o serviço de backend no Render, certifique-se de configurar as seguintes variáveis de ambiente (**Environment Variables**) no painel do Render para que tudo funcione corretamente:

| Variável | Descrição | Exemplo / Sugestão |
| :--- | :--- | :--- |
| `DATABASE_URL` | String de conexão do seu PostgreSQL no Render | `postgres://user:pass@host:port/dbname?sslmode=require` |
| `JWT_SECRET` | Chave secreta para gerar os tokens de acesso | `uma_chave_muito_segura_e_longa` |
| `REFRESH_SECRET` | Chave secreta para os tokens de atualização | `outra_chave_segura_para_refresh` |
| `ADMIN_PASSWORD` | Senha para acessar o Painel Administrativo | `sua_senha_admin_aqui` |
| `PORT` | Porta onde o servidor vai rodar | `5000` (O Render geralmente define isso automaticamente) |

## Passos Adicionais:

1. **Build Command**: `pnpm install && pnpm build`
2. **Start Command**: `pnpm start`
3. **Root Directory**: `artifacts/api-server` (Certifique-se de apontar para a pasta do backend se o Render pedir)

O Socket.IO já está configurado para rodar na mesma porta do servidor HTTP, então o tempo real deve funcionar assim que o deploy for concluído.
