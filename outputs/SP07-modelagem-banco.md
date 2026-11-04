# BarberCom: estrutura do banco

SP07 | 28/10/2026

O banco PostgreSQL guarda os cadastros, a agenda e os atendimentos do BarberCom. A estrutura tem 15 tabelas e 78 campos.

## Como os dados se relacionam

O profissional é ligado à unidade por um vínculo. Esse vínculo tem turnos, pausas e bloqueios. A oferta liga um serviço à unidade e define seu preço e duração.

Cada atendimento pertence a um cliente e a um vínculo. Seus itens registram os serviços, adicionais e responsáveis. Um profissional pode ter uma foto enviada.

## Tabelas e campos

### usuario

Contas de clientes e gestores.

id (bigint), nome (varchar(120)), telefone (varchar(15)), senha_hash (varchar(255)), perfil (varchar(10)), ativo (boolean), google_sub (varchar(255)).

### sessao

Mantém o acesso do usuário enquanto a sessão está válida.

sid (varchar(128)), dados (jsonb), expira_em (timestamptz).

### unidade

Endereço, situação e coordenadas da barbearia.

id (bigint), nome (varchar(120)), endereco (varchar(255)), ativa (boolean), latitude (double precision), longitude (double precision).

### profissional

Nome, foto e situação do profissional.

id (bigint), nome (varchar(120)), foto_url (varchar(500)), ativo (boolean).

### foto_profissional

Guarda a foto enviada para o perfil do profissional.

profissional_id (bigint), dados (bytea).

### servico

Cadastro dos serviços, como corte e barba.

id (bigint), nome (varchar(120)), ativo (boolean).

### oferta_servico

Define o preço e a duração de cada serviço por unidade.

id (bigint), unidade_id (bigint), servico_id (bigint), preco (numeric(10,2)), duracao_minutos (integer), ativa (boolean).

### profissional_servico

Indica quais serviços cada profissional pode realizar.

profissional_id (bigint), servico_id (bigint).

### vinculo_profissional_unidade

Indica em quais unidades o profissional trabalha.

id (bigint), profissional_id (bigint), unidade_id (bigint), ativo (boolean).

### turno_trabalho

Dias da semana e horários de trabalho do vínculo.

id (bigint), vinculo_id (bigint), dia_semana (smallint), hora_inicio (time), hora_fim (time).

### pausa_trabalho

Intervalos dentro de um turno.

id (bigint), turno_id (bigint), descricao (varchar(120)), hora_inicio (time), hora_fim (time).

### bloqueio_agenda

Feriados e indisponibilidades em uma data específica.

id (bigint), vinculo_id (bigint), data (date), descricao (varchar(120)), tipo (varchar(20)), hora_inicio (time), hora_fim (time).

### agendamento

Reserva do cliente ou registro de atendimento avulso.

id (bigint), cliente_id (bigint), vinculo_id (bigint), inicio (timestamp), fim (timestamp), status (varchar(12)), valor_total (numeric(10,2)), criado_em (timestamptz), origem (varchar(12)).

### item_agendamento

Serviços e adicionais, com preço e responsável por item.

id (bigint), agendamento_id (bigint), oferta_id (bigint), nome (varchar(120)), preco (numeric(10,2)), duracao_minutos (integer), tipo (varchar(10)), profissional_id (bigint).

### verificacao_telefone

Tabela antiga de SMS, mantida sem uso no cadastro atual.

telefone (varchar(15)), nome (varchar(120)), senha_hash (varchar(255)), codigo_hash (varchar(64)), expira_em (timestamptz), tentativas (integer), enviado_em (timestamptz).

## Regras de funcionamento

* O telefone de acesso é único. O perfil da conta é CLIENTE ou GESTOR. A senha fica armazenada como hash.
* Um profissional pode trabalhar em várias unidades. Cada unidade define o preço e a duração dos serviços que oferece.
* O banco impede a repetição do mesmo vínculo e da mesma oferta. Também bloqueia turnos sobrepostos do profissional em vínculos ativos.
* Ao reservar, o backend confere os serviços, o turno, as pausas, os bloqueios e a ocupação do cliente e dos profissionais.
* Cancelar muda a situação da reserva e mantém o histórico. Os itens guardam o nome e o preço cobrados no atendimento.
* O atendimento avulso registra um serviço já realizado. Ele entra no histórico como concluído.

## Observações para a apresentação

* O cadastro atual não usa SMS. A tabela verificacao_telefone foi preservada, mas está sem uso.
* A sessão guarda a identificação do usuário em JSON. Não há chave estrangeira entre sessao e usuario.
* As coordenadas usadas na apresentação são fictícias. A distância é calculada em linha reta.
* O acesso de gestor sem senha válida é uma configuração local de demonstração.

Os diagramas estão no PDF e em SP07-diagrama-banco.mmd. Os tipos, as chaves e as restrições completas estão em docs/modelagem.md e nos scripts SQL de database/.
