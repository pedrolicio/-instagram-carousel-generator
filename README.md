# Gerador Automatizado de Carrosséis Instagram

Plataforma web desenvolvida com React e TailwindCSS que permite agências de marketing gerenciarem múltiplos clientes, cadastrar brand kits completos e gerar carrosséis para Instagram com apoio de IA.

## 🚀 Funcionalidades

- **Gestão de clientes**: cadastre, edite e exclua brand kits completos com paleta de cores, tom de voz e referências.
- **Geração automática de conteúdo**: integração com a API da Claude (Anthropic) para sugerir slides, legendas e descrições visuais.
- **Geração de imagens**: prompts otimizados para a API Imagen 3 (Google AI) com acompanhamento de progresso.
- **Histórico**: armazena todos os carrosséis gerados com filtros por cliente e busca por tema.
- **Configurações de API**: armazenamento seguro (com codificação base64) das chaves de API no navegador.

## 🧱 Estrutura do Projeto

```
src/
├── App.jsx
├── components/
│   ├── ApiKeySettings.jsx
│   ├── BrandKitForm.jsx
│   ├── CarouselGenerator.jsx
│   ├── ClientManager.jsx
│   ├── ContentPreview.jsx
│   ├── HistoryView.jsx
│   ├── AccessGate.jsx
│   └── ImageGenerator.jsx
├── context/
│   └── AppContext.jsx
├── services/
│   ├── claudeService.js
│   ├── imagenService.js
│   └── storageService.js
├── utils/
│   ├── brandKitValidator.js
│   └── promptBuilder.js
├── main.jsx
└── styles.css
```

## ⚙️ Pré-requisitos

- Node.js 18+
- npm

## ▶️ Como rodar localmente

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Execute o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

3. Acesse em [http://localhost:5173](http://localhost:5173).

## 🔑 Controle de acesso

O painel pode ser protegido por um código de acesso simples, exigido antes de exibir a aplicação. Configure um arquivo `.env`
com uma das variáveis abaixo antes de rodar o build/deploy:

- `VITE_ACCESS_CODES`: lista separada por vírgulas com os códigos em texto puro (ex.: `VITE_ACCESS_CODES=senha1,senha2`).
- `VITE_ACCESS_CODE_HASHES`: lista separada por vírgulas com os hashes SHA-256 dos códigos. Use esta opção quando quiser evitar
  expor os códigos em texto claro no bundle final.

Para gerar o hash de um código, execute no terminal:

```bash
node -e "import('crypto').then(({ createHash }) => console.log(createHash('sha256').update('SEU-CODIGO').digest('hex')));"
```

Durante o login, o usuário pode optar por lembrar o dispositivo. Nesse caso o hash é guardado no `localStorage`; caso contrário
é salvo apenas na sessão atual (`sessionStorage`).

## 🔐 Configuração das APIs

No menu **Configurações**, informe as chaves das APIs:

- **Anthropic API Key**: usada para gerar o conteúdo textual.
- **Google AI API Key**: usada para gerar imagens com a Imagen 3.

As chaves são criptografadas localmente com AES-GCM via Web Crypto antes de serem salvas no `localStorage`. Para acessar ou atualizar
as chaves é necessário informar a mesma frase-secreta utilizada na criptografia. Opcionalmente é possível lembrar a frase apenas
durante a sessão atual (armazenada em `sessionStorage`).

## 🧪 Observações

- Caso as chaves não estejam configuradas, o gerador cria um carrossel de demonstração para que o fluxo possa ser testado sem custo.
- As requisições às APIs são feitas diretamente do frontend e respeitam a estrutura de prompt descrita no documento de especificação.

## 📄 Licença

Projeto de exemplo para fins educacionais.
