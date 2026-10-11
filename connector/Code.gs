var cc = DataStudioApp.createCommunityConnector();

function getConfig() {
  var config = cc.getConfig();

  config.newInfo()
    .setId('info')
    .setText('Conecta direto na planilha de respostas do Google Forms. Sem cache: cada "Atualizar" no Looker Studio traz o dado mais recente.');

  config.newTextInput()
    .setId('sheetUrl')
    .setName('URL da planilha de respostas')
    .setHelpText('Cole o link completo da planilha do Google Sheets vinculada ao Forms.')
    .setPlaceholder('https://docs.google.com/spreadsheets/d/XXXXXXXX/edit');

  config.newTextInput()
    .setId('sheetName')
    .setName('Nome da aba (opcional)')
    .setHelpText('Deixe em branco para usar a primeira aba da planilha.')
    .setPlaceholder('Respostas ao formulário 1');

  config.setDateRangeRequired(false);
  return config.build();
}

function getSchema(request) {
  return { schema: buildFields_(request.configParams).build() };
}

function getData(request) {
  var fields = buildFields_(request.configParams);
  var requestedFields = fields.forIds(
    request.fields.map(function (f) { return f.name; })
  );

  var rows = getRows_(request.configParams);
  var data = rows.map(function (row) {
    var values = requestedFields.asArray().map(function (field) {
      var id = field.getId();
      if (id === 'respostas') return 1;
      var idx = parseInt(id.replace('col', ''), 10);
      return row[idx] !== undefined && row[idx] !== null ? String(row[idx]) : '';
    });
    return { values: values };
  });

  return {
    schema: requestedFields.build(),
    rows: data
  };
}

function getAuthType() {
  return cc.newAuthTypeResponse().setAuthType(cc.AuthType.NONE).build();
}

function isAdminUser() {
  return true;
}

// ---- helpers ----

function buildFields_(configParams) {
  var headers = getHeaders_(configParams);
  var fields = cc.getFields();
  var types = cc.FieldType;

  headers.forEach(function (header, i) {
    fields.newDimension()
      .setId('col' + i)
      .setName(header || ('Coluna ' + (i + 1)))
      .setType(types.TEXT);
  });

  fields.newMetric()
    .setId('respostas')
    .setName('Respostas')
    .setType(types.NUMBER)
    .setAggregation(cc.AggregationType.SUM);

  return fields;
}

function extractSheetId_(url) {
  var match = url && url.match(/[-\w]{25,}/);
  if (!match) {
    cc.newUserError()
      .setText('URL da planilha inválida. Cole o link completo do Google Sheets.')
      .throwException();
  }
  return match[0];
}

function getSheet_(configParams) {
  var id = extractSheetId_(configParams.sheetUrl);
  var ss = SpreadsheetApp.openById(id);
  var name = configParams.sheetName;
  return name ? ss.getSheetByName(name) : ss.getSheets()[0];
}

function getHeaders_(configParams) {
  var sheet = getSheet_(configParams);
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

function getRows_(configParams) {
  var sheet = getSheet_(configParams);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  return sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
}
