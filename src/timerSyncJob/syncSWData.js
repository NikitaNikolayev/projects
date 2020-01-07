
const ONE_HOUR = 60 * 60 * 1000; // milliseconds
const moment = require('moment');
const superagent = require('superagent');
const logger = require('./logger');

function swAppRequestParse(swRes) {
  if (swRes.redirects && swRes.redirects.length > 0) {
    if (swRes.redirects[0].indexOf('https://app.singlewindow.cn/cas/login') !== -1) {
      // https://app.singlewindow.cn/cas/login?service=https%3A%2F%2Fswapp.singlewindow.cn%2Fdecserver%2Fj_spring_cas_security_check
      return { error: 'redirect' };
    }
    return { error: swRes.redirects[0] };
  }
  if (swRes.status && swRes.status === 200 && swRes.body) {
    return swRes.body;
  }
  if (swRes.body && swRes.body.errors) {
    return { error: swRes.body.errors };
  }
  return { error: swRes.status };
}

function weloAppRequestParse(weloRes) {
  if (weloRes.body.status !== 200) {
    if (weloRes.body.msg && weloRes.body.msg === 'access_token is not valid') {
      return { error: 'invalid-token' };
    }
    return { error: weloRes.body.status };
  }
  return weloRes.body;
}

async function loadEntrys(ieFlag, limit, cusDecStatus) { // 读取报关单
  const decStatusInfo = {
    operType: '0',
    dclTrnRelFlag: '0',
    etpsCategory: 'C', // A一般报关单位 B消费使用单位 c报关收发货人
    cusIEFlag: ieFlag,
    cusCiqNo: '',
    entryId: '',
    queryPage: 'cusAdvancedQuery',
    updateTime: moment().format('YYYY-MM-DD'),
    updateTimeEnd: moment().format('YYYY-MM-DD'),
  };
  // cusDecStatus: '', // 状态 10 结关 1 暂存 7 审结
  if (cusDecStatus) {
    decStatusInfo.cusDecStatus = cusDecStatus;
  }
  const queryParam = {
    limit,
    offset: 0,
    stName: 'updateTime',
    stOrder: 'desc',
    decStatusInfo: encodeURI(encodeURI(JSON.stringify(decStatusInfo))),
  };
  let res;
  await superagent.get(`${global.g_sharedUserConf.swapp_endpoint}/decserver/sw/dec/merge/cusQuery`)
    .set({
      cookie: global.g_sharedUserConf.swapp.cookie,
      Accept: 'application/json, text/javascript, */*; q=0.01',
    })
    // .redirects(0)
    .query(queryParam)
    .then((response) => {
      res = swAppRequestParse(response);
    })
    .catch((e) => {
      res = { error: e.stack };
    });
  return res;
}

async function handleDownloadDecl(cusCiqNo, entryId, ownerPartnerId, ownerTenantId) { // 下载报关单
  const res = await superagent.get(`${global.g_sharedUserConf.swapp_endpoint}/decserver/entries/direct/ftl/1/0/0/${cusCiqNo}.pdf`)
    .set({ Accept: 'application/json, text/javascript, */*; q=0.01', cookie: global.g_sharedUserConf.swapp.cookie });
  const docData = {
    billNo: entryId,
    bizObject: 'cmsCustomsDecl',
    docType: -5,
  };
  if (ownerPartnerId) {
    docData.ownerPartnerId = ownerPartnerId;
  }
  if (ownerTenantId) {
    docData.ownerTenantId = ownerTenantId;
  }
  const buffer = Buffer.from(res.body.data.pdf, 'base64');
  const uploadRes = await superagent.post(`${global.g_sharedUserConf.welo_endpoint}/v1/saas/openapi/upload?token=${global.g_sharedUserConf.weloapp.accesstoken}`)
    .set({ 'X-WELO-CORS-ALLOW': true })
    .field('data', JSON.stringify(docData))
    .attach('file', buffer, { filename: `报关单${entryId}.pdf` });
  await superagent.post(`${global.g_sharedUserConf.welo_endpoint}/v1/sw/decl/entry?token=${global.g_sharedUserConf.weloapp.accesstoken}`)
    .set({ Accept: 'application/json, text/javascript, */*; q=0.01', 'X-WELO-CORS-ALLOW': true })
    .send({
      declHead: {
        entry_id: entryId,
        ccd_file: uploadRes.body.data.doc_cdnurl,
      },
      updateDecl: true, // 仅更新declHead
    });
}

async function handleDownloadDocus(preDecDocVo) { // 下载报关单单证
  for (let i = 0; i < preDecDocVo.length; i++) {
    const attachDoc = preDecDocVo[i];
    const edocId = attachDoc.attEdocId;
    if (edocId) {
      const res = await superagent.get(`${global.g_sharedUserConf.swapp_endpoint}/decserver/sw/doc/cus/download/${edocId}.pdf`)
        .set({ cookie: global.g_sharedUserConf.swapp.cookie })
        .responseType('blob');
      const buffer = res.body;
      await superagent.post(`${global.g_sharedUserConf.welo_endpoint}/v1/sw/decl/docu?token=${global.g_sharedUserConf.weloapp.accesstoken}`)
        .set({ 'X-WELO-CORS-ALLOW': true })
        .field('att_edoc_id', edocId)
        .attach('file', buffer);
    }
  }
}

async function sendEntrysToWelo(entryList) { // 发送报关单
  try {
    for (let i = 0; i < entryList.length; i++) {
      const entry = entryList[i];
      const entryDetailRes = await superagent.post(`${global.g_sharedUserConf.swapp_endpoint}/decserver/sw/dec/merge/queryDecData`)
        .set({ Accept: 'application/json, text/javascript, */*; q=0.01', cookie: global.g_sharedUserConf.swapp.cookie })
        .send({
          cusCiqNo: entry.cusCiqNo,
        });
      const res = swAppRequestParse(entryDetailRes);
      if (res.error) {
        return res;
      }
      const resData = res.data;
      const declHeadVo = resData.preDecHeadVo;
      const preDecDocVo = JSON.parse(declHeadVo.preDecDocVo);
      const declHeadWo = {
        pre_entry_seq_no: declHeadVo.copNo,
        sw_decl_status: declHeadVo.cusDecStatus,
        i_e_type: declHeadVo.cusIEFlag === 'I' ? 0 : 1,
        spec_decl_flag: declHeadVo.specDeclFlag,
        insp_orgcode: declHeadVo.inspOrgCode,
        dec_unified_no: declHeadVo.cusCiqNo || '',
        entry_id: declHeadVo.entryId || '',
        insur_rate: declHeadVo.insurRate,
        ciq_orgcode: declHeadVo.orgCode,
        contr_no: declHeadVo.contractNo,
        purp_orgcode: declHeadVo.purpOrgCode,
        note: declHeadVo.noteS,
        owner_ciqcode: declHeadVo.ownerCiqCode,
        origin_port: declHeadVo.despPortCode,
        owner_custco: declHeadVo.ownerCode,
        owner_name: declHeadVo.ownerName,
        agent_custco: declHeadVo.agentCode,
        agent_ciqcode: declHeadVo.declRegNo,
        agent_name: declHeadVo.agentName,
        trans_mode: declHeadVo.transMode,
        dept_dest_country: declHeadVo.cusTradeCountry,
        insur_mark: declHeadVo.insurMark,
        vsa_orgcode: declHeadVo.vsaOrgCode,
        trade_mode: declHeadVo.tradeModeCode,
        d_date: declHeadVo.dDate,
        agent_code: declHeadVo.agentScc,
        traf_mode: declHeadVo.cusTrafMode,
        traf_name: declHeadVo.trafName,
        bl_wb_no: declHeadVo.billNo,
        pack_count: declHeadVo.packNo,
        license_no: declHeadVo.licenseNo,
        insur_curr: declHeadVo.insurCurr,
        fee_curr: declHeadVo.feeCurr,
        fee_rate: declHeadVo.feeRate,
        storage_place: declHeadVo.goodsPlace,
        trxn_mode: declHeadVo.transMode,
        i_e_date: declHeadVo.iEDate,
        wrap_type: declHeadVo.wrapType,
        owner_code: declHeadVo.ownerScc,
        i_e_port: declHeadVo.iEPort,
        net_wt: declHeadVo.netWt,
        cert_mark: declHeadVo.attaDocuCdstr,
        fee_mark: declHeadVo.feeMark,
        other_curr: declHeadVo.otherCurr,
        other_rate: declHeadVo.otherRate,
        other_mark: declHeadVo.otherMark,
        mark_note: declHeadVo.markNo,
        voyage_no: declHeadVo.ciqVoyageNo,
        special_relation: declHeadVo.promiseItems && declHeadVo.promiseItems[0],
        price_effect: declHeadVo.promiseItems && declHeadVo.promiseItems[1],
        payment_royalty: declHeadVo.promiseItems && declHeadVo.promiseItems[2],
        cut_mode: declHeadVo.cutMode,
        manual_no: declHeadVo.manualNo,
        trade_country: declHeadVo.cusTradeNationCode,
        complete_discharge_date: declHeadVo.cmplDschrgDt,
        gross_wt: declHeadVo.grossWt,
        depart_date: declHeadVo.despDate,
        entry_exit_zone: declHeadVo.ciqEntyPortCode,
        decl_port: declHeadVo.customMaster,
        cdf_flag: declHeadVo.entryType,
        district_code: declHeadVo.districtCode,
        pre_entry_id: declHeadVo.preEntryId,
        dept_dest_port: declHeadVo.distinatePort,
      };
      if (declHeadWo.i_e_type === 1) {
        declHeadWo.oversea_entity_aeocode = declHeadVo.consigneeCode;
        declHeadWo.oversea_entity_name = declHeadVo.consigneeEname;
        declHeadWo.trade_co = declHeadVo.cnsnTradeScc;
        declHeadWo.trade_custco = declHeadVo.cnsnTradeCode;
        declHeadWo.trader_ciqcode = declHeadVo.consignorCode;
        declHeadWo.trade_name = declHeadVo.consignorCname;
      } else {
        declHeadWo.oversea_entity_aeocode = declHeadVo.consignorCode;
        declHeadWo.oversea_entity_name = declHeadVo.consignorEname;
        declHeadWo.oversea_entity_cname = declHeadVo.consignorCname;
        declHeadWo.trade_co = declHeadVo.rcvgdTradeScc;
        declHeadWo.trade_custco = declHeadVo.rcvgdTradeCode;
        declHeadWo.trader_ciqcode = declHeadVo.consigneeCode;
        declHeadWo.trade_name = declHeadVo.consigneeCname;
      }
      const declBody = JSON.parse(declHeadVo.decMergeListVo).map(dlv => ({
        product_spec: dlv.goodsSpec,
        hscode: dlv.codeTs,
        orig_country: dlv.cusOriginCountry,
        qty_1: dlv.qty1,
        qty_2: dlv.qty2,
        duty_mode: dlv.dutyMode,
        version_no: dlv.exgVersion,
        brand: dlv.goodsBrand,
        unit_1: dlv.unit1,
        external_lot_no: dlv.prodBatchNo,
        unit_2: dlv.unit2,
        g_unit: dlv.gUnit,
        trade_curr: dlv.tradeCurr,
        orig_place_code: dlv.origPlaceCode,
        dest_country: dlv.destinationCountry,
        goods_attr: dlv.goodsAttr,
        product_models: dlv.goodsModel,
        g_no: dlv.gNo,
        em_g_no: dlv.contrItem,
        g_model: dlv.gModel,
        purpose: dlv.purpose,
        g_qty: dlv.gQty,
        dec_price: parseFloat(dlv.declPrice),
        trade_total: parseFloat(dlv.declTotal),
        g_name: dlv.gName,
        district_code: dlv.districtCode,
        district_region: dlv.ciqDestCode,
        ciqcode: dlv.ciqCode,
      }));
      declHeadWo.updateTime = declBody[0] ? moment(declBody[0].updateTime, 'YYYY-MM-DD HH:mm:ss')
        : moment(declHeadVo.updateTime, 'YYYY-MM-DD');
      const postRes = await superagent.post(`${global.g_sharedUserConf.welo_endpoint}/v1/sw/decl/entry`)
        .set({ Accept: 'application/json, text/javascript, */*; q=0.01', 'X-WELO-CORS-ALLOW': true })
        .send({
          declHead: declHeadWo,
          declBody,
          declDocus: preDecDocVo.map(ddv => ({
            pre_entry_seq_no: declHeadVo.copNo,
            docu_code: ddv.attEdocNo,
            docu_spec: ddv.attTypeCode,
            // docu_file: ddv.attEdocPath,
            attach_file: ddv.attachFile,
            docu_filename: ddv.entOrigFileName,
            att_edoc_id: ddv.attEdocId,
            att_seq_no: ddv.attSeqNo,
          })),
          declCerts: JSON.parse(declHeadVo.cusLicenseListVo).map(llv => ({
            pre_entry_seq_no: declHeadVo.copNo,
            cert_seq: llv.formSeqNo,
            cert_code: llv.acmpFormCode,
            cert_spec: llv.acmpFormCodeName,
            cert_num: llv.acmpFormNo,
            cert_file: llv.preDecCusEcoRel,
          })),
          declContainers: JSON.parse(declHeadVo.preDecContainerVo).map(dcv => ({
            pre_entry_seq_no: declHeadVo.copNo,
            container_seq: dcv.contSeqNo,
            entry_id: dcv.entryId,
            container_id: dcv.containerNo,
            container_wt: dcv.containerWt,
            container_goods_wt: dcv.containerGoodsWt,
            container_spec: dcv.containerMdCode,
            decl_g_no_list: dcv.goodsNo,
            lcl_flag: dcv.lclFlag,
          })),
          declHeadVo,
          plainParam: true,
          token: global.g_sharedUserConf.weloapp.accesstoken,
        });
      const parseDate = weloAppRequestParse(postRes);
      if (parseDate.error) {
        return parseDate;
      }
      if (parseDate && parseDate.noCdfFile) {
        await handleDownloadDecl(declHeadVo.cusCiqNo, declHeadVo.entryId,
          parseDate.ownerPartnerId, parseDate.ownerTenantId);
      }
      if (parseDate && !parseDate.uploaded) {
        await handleDownloadDocus(preDecDocVo);
      }
    }
  } catch (e) {
    return { error: e.stack };
  }
  logger.info(`报关单处理${entryList.length}条`);
  return {};
}

async function loadDecMod(limit) { // 修撤单
  const decModCondition = {
    decModType: null,
    decModTypeName: null,
    cusCiqNo: '',
    entryId: '',
    modAffirmDate: moment().format('YYYY-MM-DD'),
    modAffirmDateEnd: moment().format('YYYY-MM-DD'),
  };
  const queryParam = {
    limit,
    offset: 0,
    fromCondition: encodeURI(encodeURI(JSON.stringify(decModCondition))),
  };
  let resData;
  await superagent.get(`${global.g_sharedUserConf.swapp_endpoint}/decmmodserver/sw/mmod/queryRevokeList`)
    .set({
      cookie: global.g_sharedUserConf.swapp.cookie,
      Accept: 'application/json, text/javascript, */*; q=0.01',
    })
    // .redirects(0)
    .query(queryParam)
    .then((response) => {
      resData = swAppRequestParse(response);
    })
    .catch((e) => {
      resData = { error: e.stack };
    });
  return resData;
}

async function sendDecModToWelo(decModList) { // 发送撤修单
  try {
    for (let i = 0; i < decModList.length; i++) {
      const decMod = decModList[i];
      const decModDetailRes = await superagent.post(`${global.g_sharedUserConf.swapp_endpoint}/decmmodserver/sw/cus/mod/queryDecMod?decModSeqNo=${decMod.decModSeqNo}`)
        .set({ Accept: 'application/json, text/javascript, */*; q=0.01', cookie: global.g_sharedUserConf.swapp.cookie });
      const res = swAppRequestParse(decModDetailRes);
      if (res.error) {
        return res;
      }
      const modData = res.data;
      const { decModHeadVo } = modData.decModVo;
      const decModHeadWo = {
        dec_mod_seq_no: decModHeadVo.decModSeqNo,
        mod_entry_id: decModHeadVo.modCusNo,
        entry_id: decModHeadVo.entryId,
        dec_mod_type: decModHeadVo.decModType,
        d_date: decModHeadVo.dDate && moment(decModHeadVo.dDate).valueOf(),
        mod_apply_status: decModHeadVo.decModStatus,
        dec_mod_note: decModHeadVo.decModNote,
        applier_name: decModHeadVo.applErName,
        appl_time: decModHeadVo.applTime,
        feed_dept: decModHeadVo.feedDept,
        ent_op_name: decModHeadVo.entOpName,
        ent_op_tel: decModHeadVo.entOpTel,
      };
      const postRes = await superagent.post(`${global.g_sharedUserConf.welo_endpoint}/v1/sw/decl/mod`)
        .set({ Accept: 'application/json, text/javascript, */*; q=0.01', 'X-WELO-CORS-ALLOW': true })
        .send({
          decModHead: decModHeadWo,
          decModList: modData.decModVo.decModList.map(dml => ({
            dec_mod_no: dml.decModNo,
            dec_mod_seq_no: dml.decModSeqNo,
            dec_list_type: parseInt(dml.decListType, 0),
            dec_list_no: dml.decListNo,
            dec_field_code: dml.decFieldCode,
            field_orig_value: dml.fieldOrigValue,
            field_mod_value: dml.fieldModValue,
          })),
          plainParam: true,
          token: global.g_sharedUserConf.weloapp.accesstoken,
        });
      const parseDate = weloAppRequestParse(postRes);
      if (parseDate.error) {
        return parseDate;
      }
    }
  } catch (e) {
    return { error: e.stack };
  }
  logger.info(`修撤单处理${decModList.length}条`);
  return {};
}

async function loadTaxPay(limit) { // 税费单
  const paidCondition = {
    entryId: '',
    taxId: '',
    billNo: '',
    contrNo: '',
    ownerName: '',
    taxType: '',
    declPort: '',
    handOrgName: '',
    protocolNo: '',
    dealTimeEnd: moment().format('YYYY-MM-DD'),
    dealTimeStart: moment().format('YYYY-MM-DD'),
    isNeedCount: '1',
  };
  const queryParam = {
    limit,
    offset: 0,
    fromCondition: JSON.stringify(paidCondition),
  };
  let resData;
  await superagent.get(`${global.g_sharedUserConf.swapp_endpoint}/splserver/spl/epiTaxOptimize/querySwHisEpiTaxSuccessRecodes`) // 支付成功的URL
    .set({
      Accept: 'application/json, text/javascript, */*; q=0.01',
      cookie: global.g_sharedUserConf.swapp.cookie,
      rdtime: global.g_sharedUserConf.swapp.userinfo.rdtime,
    })
    // .redirects(0)
    .query(queryParam)
    .then((response) => {
      resData = swAppRequestParse(response);
      const prsData = JSON.parse(response.body);
      if (prsData.errCode && prsData.errCode === '101') {
        resData = { rows: [], total: 0 };
      } else if (prsData.errCode && prsData.errCode !== '100') {
        resData = { error: prsData.errMsg };
      } else {
        resData = {
          rows: prsData.unSafeBusinessData.rows,
          total: Number(prsData.unSafeBusinessData.total),
        };
      }
    })
    .catch((e) => {
      resData = { error: e.stack };
    });
  return resData;
}

async function uploadTaxPrintDoc(swTaxId, taxvouNo) {
  const queryDocRes = await superagent.post(`${global.g_sharedUserConf.swapp_endpoint}/splserver/spl/documentPrint/queryDocument`)
    .type('json')
    .set({
      cookie: global.g_sharedUserConf.swapp.cookie,
      rdtime: global.g_sharedUserConf.swapp.userinfo.rdtime,
    })
    .send([{
      swTaxId,
      operationType: '1',
    }]);
  if (queryDocRes.body.errCode && queryDocRes.body.errCode !== '100') {
    return;
  }
  const { flag } = queryDocRes.body.unSafeBusinessData;
  const taxPdfRes = await superagent.get(`${global.g_sharedUserConf.swapp_endpoint}/splserver/spl/documentPrint/viewByFlag/${flag}.pdf`)
    .set({ cookie: global.g_sharedUserConf.swapp.cookie })
    .responseType('blob');
  const pdfUploadRes = await superagent.post(`${global.g_sharedUserConf.welo_endpoint}/v1/saas/openapi/upload?token=${global.g_sharedUserConf.weloapp.accesstoken}`)
    .set({ 'X-WELO-CORS-ALLOW': true })
    .field('data',
      JSON.stringify({
        billNo: taxvouNo,
        bizObject: 'cmsCustomsDecl',
        docType: -4,
      }))
    .attach('file', taxPdfRes.body, `${taxvouNo}.pdf`);
  if (pdfUploadRes.body.status === 200) {
    await superagent.post(`${global.g_sharedUserConf.welo_endpoint}/v1/sw/tax/putpayment?token=${global.g_sharedUserConf.weloapp.accesstoken}`)
      .set({ 'X-WELO-CORS-ALLOW': true })
      .type('json')
      .send({
        tax_vouchno: taxvouNo,
        update: {
          tax_printdoc_url: pdfUploadRes.body.data.doc_cdnurl,
        },
      });
  }
}

async function sendTaxPayToWelo(taxPayList) { // 发送税费单
  try {
    for (let i = 0; i < taxPayList.length; i++) {
      const declTaxPay = taxPayList[i];
      const queryParam = {
        limit: 50,
        offset: 0,
        taxHeadSeqNo: declTaxPay.taxHeadSeqNo,
      };
      const detailRes = await superagent.post(`${global.g_sharedUserConf.swapp_endpoint}/splserver/spl/epiTax/queryTaxDetailByExpAndPage`)
        .set({
          Accept: 'application/json, text/javascript, */*; q=0.01',
          cookie: global.g_sharedUserConf.swapp.cookie,
          rdtime: global.g_sharedUserConf.swapp.userinfo.rdtime,
        })
        .query(queryParam);
      const res = swAppRequestParse(detailRes);
      if (res.error) {
        return res;
      }
      const prsData = JSON.parse(detailRes.body);
      if (prsData.errCode === '100') {
        const taxPay = {};
        Object.keys(declTaxPay).forEach((tpKey) => {
          if (
            ['addTime', 'billDate', 'taxDate', 'entrustDate', 'updateTime',
              'iEDate',
              'transStatusName', 'transStatusStr', 'updateUser', 'limitDate',
            ].indexOf(tpKey) === -1
          ) {
            taxPay[tpKey] = declTaxPay[tpKey];
          }
        });
        const postRes = await superagent.post(`${global.g_sharedUserConf.welo_endpoint}/v2/sw/tax/payanddetail`)
          .set({ Accept: 'application/json, text/javascript, */*; q=0.01', 'X-WELO-CORS-ALLOW': true })
          .send({
            taxPay,
            taxPayDts: prsData.unSafeBusinessData.rows,
            token: global.g_sharedUserConf.weloapp.accesstoken,
          });
        const parseDate = weloAppRequestParse(postRes);
        if (parseDate.error) {
          return parseDate;
        }
        if (declTaxPay.swTaxId && postRes.body.data && postRes.body.data.printdoc) {
          await uploadTaxPrintDoc(declTaxPay.swTaxId, declTaxPay.taxvouNo);
        }
      }
    }
  } catch (e) {
    return { error: e.stack };
  }
  logger.info(`税费单处理${taxPayList.length}条`);
  return {};
}

const syncSingleWindowData = async (bizType, callBack) => {
  try {
    const initLimit = 50;
    logger.info(`本次同步单证类型${bizType}`);
    for (let i = 0; i < bizType.length; i++) {
      const type = bizType[i];
      if (type === 'A') { // 报关单
        let entryList = [];
        const iEntrysRes = await loadEntrys('I', initLimit);
        if (iEntrysRes.error) {
          callBack(iEntrysRes.error);
          return;
        }
        if (Number(iEntrysRes.total) > initLimit) {
          const allIEntrysRes = await loadEntrys('I', Number(iEntrysRes.total));
          if (allIEntrysRes.error) {
            callBack(allIEntrysRes.error);
            return;
          }
          entryList = entryList.concat(allIEntrysRes.rows);
        } else {
          entryList = entryList.concat(iEntrysRes.rows);
        }
        const iCloseEntrysRes = await loadEntrys('I', initLimit, '10');
        if (iCloseEntrysRes.error) {
          callBack(iCloseEntrysRes.error);
          return;
        }
        if (Number(iCloseEntrysRes.total) > initLimit) {
          const allICloseEntrysRes = await loadEntrys('I', Number(iCloseEntrysRes.total), '10');
          if (allICloseEntrysRes.error) {
            callBack(allICloseEntrysRes.error);
            return;
          }
          entryList = entryList.concat(allICloseEntrysRes.rows);
        } else {
          entryList = entryList.concat(iCloseEntrysRes.rows);
        }
        const eEntrysRes = await loadEntrys('E', initLimit);
        if (eEntrysRes.error) {
          callBack(eEntrysRes.error);
          return;
        }
        if (Number(eEntrysRes.total) > initLimit) {
          const allIEntrysRes = await loadEntrys('E', Number(eEntrysRes.total));
          if (allIEntrysRes.error) {
            callBack(allIEntrysRes.error);
            return;
          }
          entryList = entryList.concat(allIEntrysRes.rows);
        } else {
          entryList = entryList.concat(eEntrysRes.rows);
        }
        const eCloseEntrysRes = await loadEntrys('E', initLimit, '10');
        if (eCloseEntrysRes.error) {
          callBack(eCloseEntrysRes.error);
          return;
        }
        if (Number(eCloseEntrysRes.total) > initLimit) {
          const allECloseEntrysRes = await loadEntrys('E', Number(eCloseEntrysRes.total), '10');
          if (allECloseEntrysRes.error) {
            callBack(allECloseEntrysRes.error);
            return;
          }
          entryList = entryList.concat(allECloseEntrysRes.rows);
        } else {
          entryList = entryList.concat(eCloseEntrysRes.rows);
        }
        if (entryList.length > 0) {
          const sendResult = await sendEntrysToWelo(entryList.filter(ent => ent.entryId));
          if (sendResult.error) {
            callBack(sendResult.error);
            return;
          }
        } else { logger.info('报关单处理0条'); }
      } else if (type === 'B') { // 修撤单
        let decModRes = await loadDecMod(initLimit);
        if (decModRes.error) {
          callBack(decModRes.error);
          return;
        }
        if (Number(decModRes.total) > initLimit) {
          decModRes = await loadDecMod(Number(decModRes.total));
          if (decModRes.error) {
            callBack(decModRes.error);
            return;
          }
        }
        if (decModRes.rows.length > 0) {
          const sendResult = await sendDecModToWelo(decModRes.rows);
          if (sendResult.error) {
            callBack(sendResult.error);
            return;
          }
        } else { logger.info('修撤单处理0条'); }
      } else if (type === 'C') { // 税费单
        let taxPayRes = await loadTaxPay(initLimit);
        if (taxPayRes.error) {
          callBack(taxPayRes.error);
          return;
        }
        if (taxPayRes.total > initLimit) {
          taxPayRes = await loadTaxPay(taxPayRes.total);
          if (taxPayRes.error) {
            callBack(taxPayRes.error);
            return;
          }
        }
        if (taxPayRes.rows.length > 0) {
          const sendResult = await sendTaxPayToWelo(taxPayRes.rows);
          if (sendResult.error) {
            callBack(sendResult.error);
            return;
          }
        } else { logger.info('税费单处理0条'); }
      } else if (type === 'D') { // 核注清单
      } else if (type === 'E') { // 核放单
      } else if (type === 'F') { // 业务申报表
      } else if (type === 'G') { // 出入库单

      }
    }
    callBack();
  } catch (e) {
    logger.error(e);
  }
};

module.exports = function main() {
  const jobConfig = global.g_sharedUserConf.syncjob_config;
  if (jobConfig && jobConfig.status) {
    logger.info('同步任务开始');
    syncSingleWindowData(jobConfig.bizType, (error) => {
      let interval = ONE_HOUR * jobConfig.interval;
      if (error) { // 执行失败，五分钟后再执行
        logger.error('任务未完成', error);
        if (error === 'redirect') {
          const mainIpc = global.mainWindow;
          mainIpc.webContents.send('sync-job', {
            action: 'cookie-expire',
            payload: { },
          });
        } else if (error === 'invalid-token') {
          const mainIpc = global.mainWindow;
          mainIpc.webContents.send('sync-job', {
            action: 'req-error',
            payload: { msg: 'access_token is not valid' },
          });
        } else {
          interval = 1000 * 60 * 5;
        }
      }
      setTimeout(main, interval);
      logger.info(`设置新一轮定时${interval / 60000}分钟后执行`);
    });
  } else if (jobConfig && !jobConfig.status) {
    clearTimeout();
  }
};
