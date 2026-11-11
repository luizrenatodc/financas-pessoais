# Política de segurança

## Como reportar uma vulnerabilidade

Não abra uma issue pública. Use o relato privado do GitHub: aba **Security**, **Report a vulnerability**.

## O que o projeto já faz

- Nenhum dado sai do navegador: não há servidor, conta, rastreamento nem requisições externas.
- Content-Security-Policy restritiva na página (`default-src 'self'`, sem scripts nem estilos inline).
- Todo texto de usuário é escapado antes de entrar no HTML.
- A exportação de CSV neutraliza campos que começam com `=`, `+`, `-` ou `@` (injeção de fórmula).
- A importação limita o arquivo a 5 MB e valida linha a linha.

## Pontos de atenção

- Os dados ficam no `localStorage` sem criptografia: qualquer pessoa com acesso ao navegador desbloqueado pode lê-los.
