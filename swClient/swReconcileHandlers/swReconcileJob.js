// const co = require('co');
const moment = require('moment');
const superagent = require('superagent');
const logger = require('../logger.js');

function requestParse(swRes) {
  if (swRes.redirects && swRes.redirects.length > 0) {
    process.send({ type: 'redirect' });
    return { error: 'redirect' };
  }
  if (swRes.status && swRes.status === 200 && swRes.body) {
    return swRes.body;
  }
  if (swRes.body && swRes.body.errors) {
    return { error: swRes.body.errors };
  }
  return { error: swRes.status };
}

async function loadInvt(invtParam, swappConfig, urlType) { // 读取报关单
  const response = await superagent.post(`${swappConfig.swapp_endpoint}/sasserver/sw/ems/invt/${urlType}/list`)
    .set({
      cookie: swappConfig.swapp.cookie,
      Accept: 'application/json, text/javascript, */*; q=0.01',
    })
    .send(invtParam)
    .catch((e) => {
      return { error: e.stack };
    });
  const invtRes = requestParse(response);
  return invtRes;
}
async function reconcileInvtToWelo(invtData, accesstoken, apiEp, reconcileNo) {
  const weloRes = await superagent.post(`${apiEp}/v1/sw/jg2/reconcileinvt?token=${accesstoken}`)
    .set({ Accept: 'application/json, text/javascript, */*; q=0.01', 'X-WELO-CORS-ALLOW': true })
    .send({
      reconcileNo,
      invtHeadType: invtData.invtHeadType,
      invtListType: invtData.invtListType,
      decUnifiedNo: invtData.invtDecListType[0] && invtData.invtDecListType[0].decSeqNo,
      listStat: invtData.listStat,
    });
  if (weloRes.body.status !== 200) {
    if (weloRes.body.msg && weloRes.body.msg === 'access_token is not valid') {
      return { error: 'invalid-token' };
    }
    return { error: weloRes.body.status };
  }
  return {};
}

async function updateReconcileStatus(reconcileNo, accesstoken, apiEp) {
  const weloRes = await superagent.post(`${apiEp}/v1/sw/jg2/updatereconcilejob?token=${accesstoken}`)
    .set({ Accept: 'application/json, text/javascript, */*; q=0.01', 'X-WELO-CORS-ALLOW': true })
    .send({
      reconcileNo,
    });
  if (weloRes.body.status !== 200) {
    if (weloRes.body.msg && weloRes.body.msg === 'access_token is not valid') {
      return { error: 'invalid-token' };
    }
    return { error: weloRes.body.status };
  }
  return {};
}

async function handleInvtRegDetail(seqNo, swappConfig, urlType) {
  const response = await superagent.post(`${swappConfig.swapp_endpoint}/sasserver/sw/ems/invt/${urlType}/details/${seqNo}`)
    .set({
      cookie: swappConfig.swapp.cookie,
      Accept: 'application/json, text/javascript, */*; q=0.01',
    }).send().catch((e) => {
      return { error: e.stack };
    });
  const resParsed = await requestParse(response);
  return resParsed;
}

class DownloadSasMessageHandler {
  constructor() {
    this.type = 'sw-reconcile-job';
    this.swconfig = global.swconfig;
  }

  work(payload, callback) {
    const {
      bizNo, reconcileNo, bizType, ownerCusCode, startDate,
      endDate, declareCuscode,
    } = payload;
    logger.info('reconcile-job', `任务单号${reconcileNo}`);
    const { swappConfig } = global;
    const { clientapp } = this.swconfig;
    (async () => {
      try {
        const invtParam = {
          status: ' ',
          statusName: '全部',
          selTradeCode: declareCuscode,
          impExpMarkCd: 'I',
          impExpMarkCdName: '进口',
          bondInvtNo: '',
          seqNo: '',
          bizopEtpsNo: ownerCusCode,
          invtType: '',
          invtTypeName: '',
          vrfdedMarkcd: '',
          vrfdedMarkcdName: '',
          etpsInnerInvtNo: '',
        };
        if (bizNo) {
          invtParam.bondInvtNo = bizNo;
        }
        if (startDate && endDate) {
          invtParam.inputDateStart = moment(startDate).format('YYYYMMDD');
          invtParam.inputDateEnd = moment(endDate).format('YYYYMMDD');
        }
        let urlType;
        if (bizType === 'ptsinvt') {
          urlType = 'Bws';
        } else if (bizType === 'nptsinvt') {
          urlType = 'Npts';
        } else {
          urlType = 'Nems';
        }
        let invtDataList = [];
        const invtIRes = await loadInvt(invtParam, swappConfig, urlType);
        let jobStatus = true;
        let jobErrorMsg = null;
        if (invtIRes.error) {
          jobErrorMsg = invtIRes.error;
          jobStatus = false;
        } else if (invtIRes.code === 0 && invtIRes.data && invtIRes.data.resultList.length > 0) {
          invtDataList = invtDataList.concat(invtIRes.data.resultList);
        }
        if (jobStatus) {
          invtParam.impExpMarkCd = 'E';
          invtParam.impExpMarkCdName = '出口';
          const invtERes = await loadInvt(invtParam, swappConfig, urlType);
          if (invtERes.error) {
            jobErrorMsg = invtERes.error;
            jobStatus = false;
          } else if (invtERes.code === 0 && invtERes.data && invtERes.data.resultList.length > 0) {
            invtDataList = invtDataList.concat(invtERes.data.resultList);
          }
        }
        for (let i = 0; i < invtDataList.length; i++) {
          const invt = invtDataList[i];
          const invtDataRes = await handleInvtRegDetail(invt.seqNo, swappConfig, urlType);
          if (invtDataRes.data) {
            const postInvtRes = await reconcileInvtToWelo(
              invtDataRes.data, clientapp.token, clientapp.openapi_url, reconcileNo,
            );
            if (postInvtRes.error) {
              jobStatus = false;
              jobErrorMsg = invtDataRes.error;
            }
          } else if (invtDataRes.error) {
            jobStatus = false;
            jobErrorMsg = invtDataRes.error;
          }
        }
        if (jobStatus) {
          const statusRes = await updateReconcileStatus(
            reconcileNo, clientapp.token, clientapp.openapi_url,
          );
          if (statusRes.error) {
            jobStatus = false;
            jobErrorMsg = statusRes.error;
          }
        }
        if (jobStatus) {
          logger.info(`对账任务${reconcileNo}-success`);
          callback('success');
        } else {
          logger.error(`对账任务${reconcileNo}-release`, jobErrorMsg);
          callback('release');
        }
      } catch (e) {
        logger.error(e.message, `对账任务${reconcileNo}-release`);
        callback('release');
      }
    })();
  }
}

module.exports = DownloadSasMessageHandler;
