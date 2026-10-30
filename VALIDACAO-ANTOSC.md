# ANTOSC — Lista de validação antes de publicar

Tudo o que está abaixo é informação que **o código não consegue confirmar**.
Deve ser verificada com a administração/equipa responsável. Os locais marcados
com `VALIDAR` no código HTML correspondem a estes pontos.

## 1. Números e factos institucionais
| Item | Valor usado agora | Onde | Confirmar |
|---|---|---|---|
| Sites ativos | **207** (soma do mapa); texto "mais de 200" | `js/coverage-data.js` | Valor atual e data de referência |
| Províncias com presença | **18** (linhas do mapa) | `js/coverage-data.js` | Angola tem 21 províncias na divisão atual; confirmar se as 18 seguem a divisão antiga (ex.: "Cuando Cubango") e se "Luanda" inclui Icolo e Bengo |
| Ano de fundação | **2017** (maio de 2017, como no texto "Sobre") | todas as páginas + dados estruturados | Antes havia 2010, 2015 e 2017 |
| Colaboradores | 26 | `sobre.html` (estatísticas) | Número atual |
| Meta de disponibilidade | 99,9 % (apresentada como **meta**, não garantia) | `index.html`, `sobre.html` | Se existe SLA contratual ou apenas objetivo |
| "Pioneira em Tower Sharing em Angola" | Mantida | `sobre.html`, `index.html` | Substitui "a única empresa de towerco" (removida por não ser verificável) |
| Licença Multisserviços (LMS) em 2019 e restante cronologia | Mantida | `sobre.html` (História) | Datas e marcos |
| Domínio oficial | `https://antosc.co.ao` | dados estruturados, `sitemap.xml`, `robots.txt` | Se o domínio final é este |

Para atualizar a rede: editar **apenas** `js/coverage-data.js` — mapa, verificador
de cobertura e números da página inicial recalculam-se sozinhos. Preencher
`updated` para mostrar "Dados atualizados em …" no mapa.

## 2. Liderança e organização
- Nomes, **cargos oficiais** e fotografias de António Nunes, João Baptista e Nuno Costa.
  Cargos unificados: "Presidente do Conselho de Administração", "Diretor de Operações Técnicas", "Diretor Financeiro" (antes havia "CEO", "Diretor Técnico", etc.).
- **Removido** o que não estava confirmado: anos de experiência (20+, 15+, 18+) e
  referências a projetos anteriores (UNITEL, Angola Cables, WACS, Monet, SACS, Grupo Anglobal).
  Só reinserir com autorização escrita de cada pessoa.
- Secção "Como a ANTOSC está organizada" (`sobre.html#areas`): confirmar que as 5 áreas
  (Engenharia e Projetos; Operações e Manutenção; Energia; Comercial e Parcerias; Administração e Finanças) existem.

## 3. Serviços e setores (`solucao.html`)
- Textos "O que é / O que a ANTOSC disponibiliza / Benefício" foram escritos a partir do
  que o site já afirmava. Confirmar com a área técnica e comercial.
- **Banca e corporate:** o texto original era de Saúde (hospitais, telemedicina). Foi
  reescrito de forma genérica — confirmar se a ANTOSC presta esses serviços ao setor financeiro.
- Oil & Gas ("plataformas offshore"), Minas e Agro: confirmar que são setores realmente atendidos.

## 4. Casos de sucesso (`index.html#casos-de-sucesso`)
Foram retiradas da vista as métricas sem fonte. Estão em comentário `VALIDAR` no HTML:
- Energia híbrida rural: **-65 % combustível**, **uptime 99,9 %**
- RAN Sharing: **-40 % CAPEX**
- (Removido código antigo com "50 sites em 6 meses, +45 % cobertura, -30 % OPEX" — nunca aparecia no site.)

Para cada caso a publicar, reunir: projeto/cliente (se autorizado), nº de sites, período,
indicador antes/depois e fonte. Com isso, o resultado quantitativo pode voltar ao cartão.

## 5. Contactos e formulários
- O formulário de contacto **simulava** o envio ("Mensagem enviada com sucesso") sem enviar nada.
  Agora prepara um email para a caixa correta (comercial@, info@ ou candidaturas) e diz isso ao utilizador.
  Para envio direto, preencher `FORM_ENDPOINT` em `contacto.html` quando existir backend.
- Confirmar as caixas: `info@antosc.co.ao`, `comercial@antosc.co.ao`, `Antosc-RecursosHumanos@anglobal.co.ao`
  (o rodapé tinha ainda `geral@antosc.co.ao` com texto a dizer `info@`).
- **Newsletter removida** do rodapé (o formulário apontava para `/subscribe`, que não existe).
- **YouTube removido** (apontava para a página geral do YouTube). Acrescentar o canal real, se existir.
- Instagram e Facebook removidos dos dados estruturados (não confirmados).
- Rodapé: "© … Zentury Co" corrigido para "ANTOSC S.A." — confirmar a designação legal.
- **Termos & Condições:** a página não existia; a ligação foi retirada. Criar `terms.html` com apoio jurídico, se for necessária.
- `privacy.html`: texto recuperado da pasta `site/` — rever com o jurídico.
- Parceiros: o 1.º logótipo (`imgs/logo.svg`) está identificado como "Unitel" (alt original) — confirmar. Os logótipos passaram a aparecer **a cores**, em cartões brancos.
- Parceiros: confirmar autorização para uso dos logótipos (incl. Polícia Nacional de Angola).

## 6. Mapa de rede (torres + fibra) — **dados de exemplo**
O novo mapa (`sobre.html#map`) substitui o mapa Leaflet branco. É em SVG, sem serviços externos, e lê:
- `js/coverage-data.js` — torres por província (nº de sites);
- `js/network-data.js` — **links de fibra e rotas**.

**Os links de `network-data.js` são um traçado ilustrativo** (corredores entre capitais de província,
incluindo 5 rotas transfronteiriças: Pointe-Noire, Matadi, Tshikapa, Solwezi, Oshikango). Não vieram da
ANTOSC. Enquanto `validated: false`, o mapa mostra "Traçado ilustrativo — em validação interna" e o
indicador "Links de fibra disponíveis" aparece como "(provisório)". Para publicar:
1. Substituir/ajustar os links (ativo / implementacao / pendente; interprovincial / transfronteirica).
2. Pôr `validated: true` e preencher `updated`.
- Cores: **amarelo** = fibra ativa; **vermelho tracejado** = em implementação ou pendente (as em implementação têm animação).
- O indicador "Links de fibra disponíveis" (no lugar dos colaboradores) conta os links com estado "ativo".
- As torres aparecem agregadas por província (não a localização exata de cada site).

## 7. Identidade visual — Site Alpha
- Na secção "Identidade Institucional" (`index.html`), o logótipo foi substituído pelo **Site Alpha**
  (primeiro site 5G, torre monotubular junto ao Hotel Mona Lisa).
- **A fotografia não foi enviada**: está uma ilustração provisória. Guardar a foto real como
  `imgs/site-alpha.jpg` (vertical, ~800×1000 px) e ela substitui a ilustração automaticamente.
  Confirmar o nome do hotel ("Hotel Mona Lisa") e a legenda.

## 8. O que foi corrigido tecnicamente
- Ligações partidas: `/contact.html`, `contact.html`, `terms.html`, `sucesso.html`, `#contact`, `sitemap.xml` e vários `#`.
- Caminhos `/imgs/...` passaram a relativos (o site abre em qualquer pasta/servidor).
- Favicons, `og:image` e `twitter:image` apontavam para ficheiros inexistentes.
- Dados do mapa estavam duplicados em 2 sítios de `sobre.html`; agora há fonte única.
- Fotos da liderança e telemetria otimizadas (4,2 MB → ~0,4 MB, versões `.jpg`; os `.png` originais mantêm-se).
- Criados: `sitemap.xml`, `robots.txt`, `404.html`, `privacy.html` (raiz).
- Contraste de texto: `css/contrast.css` (menu, hero, rodapé, textos secundários).
- Botões "Pedir proposta", "Saiba mais", "Solicitar proposta" e "Descubra nossas soluções" removidos.
  (O item "Soluções" do menu e o botão "Pedir cotação para esta zona" da verificação de cobertura mantiveram-se.)
- Hero de "Sobre nós": sobreposição azul substituída por um tom neutro escuro e mais leve.
  Nota: `imgs/torres.jpg` tem só 191×264 px; com menos sobreposição vê-se pixelizada em ecrãs grandes — trocar por foto em alta resolução.
- As pastas `site/` e `trash/` (versões antigas) foram mantidas sem alterações.
