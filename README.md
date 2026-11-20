# Arena Sports — versão com backend
Site de notícias e estatísticas esportivas, com resultados em tempo real.

## Requisitos
- Node.js 18 ou superior
- Chave da API-FOOTBALL (API-Sports)

## 1. Instalar dependências
Abra um terminal nesta pasta e execute:

```bash
npm install
```

## 2. Configurar a chave
1. Cadastre-se no site oficial: https://www.api-football.com/
2. No painel da API, copie sua chave.
3. Faça uma cópia do arquivo `.env.example` e renomeie a cópia para `.env`.
4. Abra `.env` e substitua `COLE_SUA_CHAVE_AQUI` pela sua chave. Não compartilhe esse arquivo e não publique sua chave.

Exemplo:
```env
API_FOOTBALL_KEY=sua_chave_aqui
PORT=3000
```

## 3. Iniciar o site
Execute:

```bash
npm start
```

Abra no navegador: http://localhost:3000

Não abra o `index.html` diretamente nem use Live Server nesta versão. O frontend precisa do servidor Node.js para consultar `/api/fixtures`.

## Publicar no GitHub Pages

O GitHub Pages publica apenas o frontend estático. O servidor Express deve ficar hospedado separadamente para manter as chaves das APIs protegidas e responder às rotas `/api/*`.

1. No Render, crie um Blueprint conectado ao repositório `thiagosilva1505/arena-sports`; o arquivo `render.yaml` configura o Web Service Node, a verificação de saúde e os nomes das variáveis secretas.
2. Durante a criação do Blueprint, informe `API_FOOTBALL_KEY` e `HIGHLIGHTLY_API_KEY` nos campos secretos solicitados pelo Render. Não use os valores no arquivo `render.yaml` nem no GitHub.
3. Aguarde o serviço ficar disponível e copie sua URL HTTPS `onrender.com`.
4. No GitHub, abra **Settings → Secrets and variables → Actions → Variables** e crie `ARENA_API_BASE_URL` com a URL do backend, sem barra final. `ALLOWED_ORIGINS` já está definido no Blueprint para o site Pages.
5. Execute o workflow **Deploy GitHub Pages** na aba **Actions**. Ele gravará a URL no `public/api-config.js` publicado.

O workflow configura `public/api-config.js` durante a publicação. Não coloque chaves de API nessa variável nem nos arquivos da pasta `public`.

Em contas GitHub Free, o Pages requer que o repositório seja público. Para manter este repositório privado, é necessário um plano que permita Pages para repositórios privados; a visibilidade do repositório não é alterada por este projeto.

## Endpoints locais
- `http://localhost:3000/api/health` — verifica se o servidor está ativo e se uma chave foi configurada.
- `http://localhost:3000/api/fixtures` — partidas do dia no fuso de São Paulo.
- `http://localhost:3000/api/standings?league=71&season=2026` — tenta buscar a classificação da liga 71 na temporada informada. A disponibilidade depende da cobertura da API e do plano.

## Observações importantes
- A chave fica no servidor, no arquivo `.env`; nunca coloque a chave no `public/script.js`.
- A API gratuita possui limites de requisições. Não configure consultas muito frequentes; use o botão de atualização enquanto desenvolvemos e respeite os limites do provedor.
- A API pode retornar zero partidas, estatísticas ausentes ou erros dependendo da data, cobertura da competição, temporada e plano.
- As notícias são reunidas de feeds RSS do Google News para futebol, basquete, vôlei, tênis e Fórmula 1; cada cartão abre a publicação original. O servidor mantém o feed em cache por 10 minutos. O painel de estatísticas usa a classificação do campeonato selecionado: partidas disputadas, gols marcados e média de gols. As tabelas, copas nacionais e fases eliminatórias continentais usam a Highlightly. O placar geral consulta a API-Football e inclui ligas de clubes e competições de seleções, como amistosos, torneios continentais e eliminatórias.
- A resposta da API pode incluir equipes e competições de diferentes países, não apenas ligas brasileiras.
