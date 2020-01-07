import React from 'react';
import {
  Button,
  Input,
  Form,
  Radio,
  Spin,
  Progress,
  message,
  Row,
  Col,
  Select,
} from 'antd';
import moment from 'moment';
import DataTable from '../components/DataTable';
import DateRangeSelect from '../components/dateRangeSelect';

const FormItem = Form.Item;
const RadioButton = Radio.Button;
const RadioGroup = Radio.Group;
const { Option } = Select;

const operTypeList = [
  { codeName: '报关单查询', codeValue: '0' },
  { codeName: '集报清单报关单查询', codeValue: '1' },
  { codeName: '其他报关单数据查询', codeValue: '2' },
];

const dclTrnRelFlagList = [
  { codeName: '一般报关单', codeValue: '0' },
  { codeName: '转关提前报关单', codeValue: '1' },
  { codeName: '备案清单', codeValue: '2' },
  { codeName: '转关提前备案清单', codeValue: '3' },
  { codeName: '出口二次转关', codeValue: '4' },
];

const etpsCategoryList = [
  { codeName: '报关申报单位', codeValue: 'A' },
  { codeName: '消费使用/生产销售单位', codeValue: 'B' },
  { codeName: '报关收发货人', codeValue: 'C' },
  { codeName: '报关录入单位', codeValue: 'D' },
];

const formItemLayout = {
  labelCol: { span: 6 },
  wrapperCol: { span: 14 },
};

export default class CusDecPane extends React.Component {
  state = {
    cusDeclDataSource: {
      total: 0,
      pageSize: 20,
      current: 1,
      list: [],
    },
    ieFlag: 'A',
    operType: '0',
    dclTrnRelFlag: ['0', '2'],
    etpsCategory: 'A',
    searchDateRange: [moment().subtract(7, 'days'), moment()],
    searchUnifiedNo: undefined,
    searchEntryId: undefined,
    listLoading: false,
    scraping: false,
    scrapeCached: false,
  };

  scrapedCusDeclCache = [];

  columns = [
    {
      title: '统一编号',
      dataIndex: 'cusCiqNo',
      width: 160,
    },
    {
      title: '海关编号',
      dataIndex: 'entryId',
      width: 160,
    },
    {
      title: '境内收货人',
      dataIndex: 'consigneeCname',
      width: 200,
      render: (consignee, row) => [consignee, row.rcvgdTradeScc].filter(cns => cns).join('|'),
    },
    {
      title: '境内发货人',
      dataIndex: 'consignorCname',
      width: 200,
      render: (consignor, row) => [consignor, row.cnsnTradeScc].filter(cns => cns).join('|'),
    },
    {
      title: '提运单号',
      dataIndex: 'billNo',
      width: 150,
    },
    {
      title: '报关状态',
      dataIndex: 'cusDecStatusName',
      width: 100,
    },
    {
      title: '进出口日期',
      dataIndex: 'iEDate',
      width: 100,
    },
    {
      title: '监管方式',
      dataIndex: 'supvModeCddeName',
      width: 100,
    },
    {
      title: '合同协议号',
      dataIndex: 'contrNo',
      width: 120,
    },
    {
      title: '商品项数',
      dataIndex: 'goodsNum',
      width: 100,
    },
    {
      title: '运输工具名称',
      dataIndex: 'trafName',
      width: 150,
    },
    {
      title: '申报单位名称',
      dataIndex: 'agentName',
      width: 170,
    },
    {
      title: '进出口标志',
      dataIndex: 'cusIEFlagName',
      width: 90,
    },
    {
      title: '申报地海关',
      dataIndex: 'customMasterName',
      width: 90,
    },
    {
      title: '入/离境口岸',
      dataIndex: 'ciqEntyPortCodeName',
      width: 170,
    },
    {
      title: '贸易国',
      dataIndex: 'cusTradeNationCodeName',
      width: 150,
    },
    {
      dataIndex: 'OPS_COL',
      className: 'table-col-ops',
      width: 50,
      fixed: 'right',
      render: (_, row) => {
        if (row.scrapeFg === 1) {
          return <Spin />;
        }
        if (row.scrapeFg === 2) {
          return <Progress type="circle" percent={100} width={25} />;
        }
        if (row.scrapeFg === 0) {
          return <Progress type="circle" status="exception" percent={22} width={25} />;
        }
        return null;
      },
    },
  ];

  componentDidMount() {
    const { swapp } = this.props.userConf;
    if (swapp && swapp.etpsCategory) {
      this.setState({ etpsCategory: swapp.etpsCategory });
    }
  }

  componentWillReceiveProps(nextProps) {
    const thisSwApp = this.props.userConf.swapp;
    const nextSwApp = nextProps.userConf.swapp;
    if (nextSwApp.etpsCategory && nextSwApp.etpsCategory !== thisSwApp.etpsCategory) {
      this.setState({ etpsCategory: nextSwApp.etpsCategory });
    }
  }

  handleDateRangeChange = (dateRange) => {
    if (dateRange && dateRange.length === 2 && dateRange[0].diff(dateRange[1], 'days') < -90) {
      message.error('时间范围不可大于90天');
      return;
    }
    this.setState({ searchDateRange: dateRange });
  };

  handleEvValueChange = (ev) => {
    const targetNode = ev.target;
    this.setState({ [targetNode.dataset.field]: targetNode.value });
  };

  handleOperTypeChange = (operType) => {
    const stateUpdate = { operType };
    if (operType === '0') {
      stateUpdate.dclTrnRelFlag = ['0', '2'];
      stateUpdate.etpsCategory = 'A';
      stateUpdate.searchDateRange = [moment().subtract(7, 'days'), moment()];
    } else {
      stateUpdate.dclTrnRelFlag = [];
      stateUpdate.etpsCategory = null;
      stateUpdate.searchDateRange = [];
      if (operType === '1') {
        stateUpdate.searchEntryId = null;
      }
    }
    this.setState(stateUpdate);
  };

  handleIeFlagChange = (radev) => {
    this.setState({ ieFlag: radev.target.value });
  };

  handleDclTrnRelFlagChange = (dclTrnRelFlag) => {
    this.setState({ dclTrnRelFlag });
  };

  handleEptCategorySel = (etpsCategory) => {
    this.setState({ etpsCategory });
  };

  handleSwCusDeclQuery = async (queryParam, swcookie) => {
    const { userConf } = this.props;
    const queryUrl = new URL(`${userConf.swapp_endpoint}/decserver/sw/dec/merge/cusQuery`);
    Object.keys(queryParam).forEach(key => queryUrl.searchParams.append(key, queryParam[key]));
    const res = await fetch(queryUrl, {
      headers: {
        cookie: swcookie || userConf.swapp.cookie,
      },
    });
    const commParsedRes = this.props.onParseSwappResult(res);
    if (commParsedRes) {
      if (commParsedRes.error === 'swapp-cookie-expire') {
        const reres = await this.handleSwCusDeclQuery(queryParam, commParsedRes.cookie);
        return reres;
      }
      message.error(commParsedRes.error);
      return { total: 0, data: [] };
    }
    const resData = await res.json();
    if (resData.message) {
      message.error(resData.message);
      return { total: 0, data: [] };
    }
    return { total: Number(resData.total), data: resData.rows };
  }

  handleCusCombineQuery = async (ieFlag, dclTrnRelFlag, cusDecStatus, swcookie) => {
    const {
      operType, searchUnifiedNo, searchEntryId,
      searchDateRange, etpsCategory,
    } = this.state;
    const decStatusInfo = {
      operType: operType || '0',
      dclTrnRelFlag: dclTrnRelFlag || '0',
      etpsCategory: etpsCategory || 'A',
      cusIEFlag: ieFlag,
      cusCiqNo: searchUnifiedNo || '',
      entryId: searchEntryId || '',
      updateTime: null,
      updateTimeEnd: null,
      queryPage: 'cusAdvancedQuery',
      cusDecStatus,
    };
    if (searchDateRange && searchDateRange.length > 0) {
      decStatusInfo.updateTime = searchDateRange[0].format('YYYY-MM-DD');
      decStatusInfo.updateTimeEnd = searchDateRange[1].format('YYYY-MM-DD');
    }
    const queryParam = {
      limit: 10,
      offset: 0,
      stName: 'updateTime',
      stOrder: 'desc',
      decStatusInfo: encodeURI(encodeURI(JSON.stringify(decStatusInfo))),
    };
    let res = await this.handleSwCusDeclQuery(queryParam, swcookie);
    if (res.total > 10) {
      queryParam.limit = Number(res.total);
      res = await this.handleSwCusDeclQuery(queryParam, swcookie);
    }
    return res.data;
  }

  handleLoadCusDeclTable = async () => {
    this.setState({ listLoading: true });
    const cusDeclDataSource = { ...this.state.cusDeclDataSource };
    const { ieFlag, dclTrnRelFlag } = this.state;
    const nextState = { listLoading: false, scrapeCached: false };
    this.scrapedCusDeclCache = [];
    const declEnrtyFlag = dclTrnRelFlag;
    if (declEnrtyFlag.length === 0) {
      declEnrtyFlag[0] = '0';
    }
    for (let i = 0; i < declEnrtyFlag.length; i++) {
      const dclTrnRel = declEnrtyFlag[i];
      if (ieFlag === 'A') {
        let queryRes = await this.handleCusCombineQuery('I', dclTrnRel, undefined); // 非结关
        this.scrapedCusDeclCache = this.scrapedCusDeclCache.concat(queryRes);
        queryRes = await this.handleCusCombineQuery('I', dclTrnRel, '10'); // 结关
        this.scrapedCusDeclCache = this.scrapedCusDeclCache.concat(queryRes);
        queryRes = await this.handleCusCombineQuery('E', dclTrnRel, undefined);
        this.scrapedCusDeclCache = this.scrapedCusDeclCache.concat(queryRes);
        queryRes = await this.handleCusCombineQuery('E', dclTrnRel, '10');
        this.scrapedCusDeclCache = this.scrapedCusDeclCache.concat(queryRes);
      } else {
        let queryRes = await this.handleCusCombineQuery(ieFlag, dclTrnRel, undefined);
        this.scrapedCusDeclCache = this.scrapedCusDeclCache.concat(queryRes);
        queryRes = await this.handleCusCombineQuery(ieFlag, dclTrnRel, '10');
        this.scrapedCusDeclCache = this.scrapedCusDeclCache.concat(queryRes);
      }
    }
    if (this.scrapedCusDeclCache.length > 0) {
      nextState.scrapeCached = true;
    }
    cusDeclDataSource.total = this.scrapedCusDeclCache.length;
    cusDeclDataSource.list = this.scrapedCusDeclCache.slice(0, cusDeclDataSource.pageSize);
    nextState.cusDeclDataSource = cusDeclDataSource;
    this.setState(nextState);
  };

  handleSwCusDeclSearch = async () => {
    await this.handleLoadCusDeclTable();
    const { etpsCategory } = this.state;
    this.props.onSessionSave({ etpsCategory });
  };

  handleTableChange = async (pagination) => {
    const { pageSize, current } = pagination;
    const cusDeclDataSource = { ...this.state.cusDeclDataSource };
    cusDeclDataSource.list = this.scrapedCusDeclCache.slice(
      (current - 1) * pageSize,
      current * pageSize,
    );
    cusDeclDataSource.current = current;
    cusDeclDataSource.pageSize = pageSize;
    this.setState({ cusDeclDataSource });
  };

  handleSwSearchReset = () => {
    this.setState({
      searchDateRange: [moment().subtract(7, 'days'), moment()],
      searchUnifiedNo: undefined,
      searchEntryId: undefined,
    });
  };

  handleCusDeclDetailPost = async (cusCiqNo, swcookie) => {
    const { userConf } = this.props;
    const queryUrl = `${userConf.swapp_endpoint}/decserver/sw/dec/merge/queryDecData`;
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: swcookie || userConf.swapp.cookie,
      },
      body: JSON.stringify({ cusCiqNo }),
    });
    const commParsedRes = this.props.onParseSwappResult(res);
    if (commParsedRes) {
      return commParsedRes;
    }
    const resJson = await res.json();
    if (!resJson.ok) {
      return { error: resJson.messageList.join(';') };
    }
    return { error: null, data: resJson.data };
  };

  postCusDataForWelo = async (cusData, accesstoken, apiEp) => {
    const declHeadVo = cusData.preDecHeadVo;
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
      declHeadWo.trade_co = declHeadVo.cnsnTradeScc;
      declHeadWo.trade_custco = declHeadVo.cnsnTradeCode;
      declHeadWo.trader_ciqcode = declHeadVo.consignorCode;
      declHeadWo.trade_name = declHeadVo.consignorCname;
      declHeadWo.oversea_entity_aeocode = declHeadVo.consigneeCode;
      declHeadWo.oversea_entity_name = declHeadVo.consigneeEname;
    } else {
      declHeadWo.trade_co = declHeadVo.rcvgdTradeScc;
      declHeadWo.trade_custco = declHeadVo.rcvgdTradeCode;
      declHeadWo.trader_ciqcode = declHeadVo.consigneeCode;
      declHeadWo.trade_name = declHeadVo.consigneeCname;
      declHeadWo.oversea_entity_aeocode = declHeadVo.consignorCode;
      declHeadWo.oversea_entity_name = declHeadVo.consignorEname;
      declHeadWo.oversea_entity_cname = declHeadVo.consignorCname;
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
    const postRes = await fetch(`${apiEp}/v1/sw/decl/entry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WELO-CORS-ALLOW': true,
      },
      body: JSON.stringify({
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
        token: accesstoken,
      }),
    });
    if (postRes.ok && postRes.status === 200) {
      try {
        const postResJson = await postRes.json();
        const returnData = postResJson.data;
        if (returnData.noCdfFile) {
          this.handleDownloadDecl(
            declHeadVo.cusCiqNo, declHeadVo.entryId, returnData.ownerPartnerId,
            returnData.ownerTenantId, apiEp, accesstoken
          );
        }
        if (!returnData.uploaded) {
          this.handleDownloadDocus(preDecDocVo, apiEp, accesstoken);
        }
        return { error: postResJson.err_msg || postResJson.err_code };
      } catch (err) {
        return { error: err.message };
      }
    }

    return { error: postRes.statusText };
  };

  handleDownloadDecl = async (
    cusCiqNo, entryId, ownerPartnerId, ownerTenantId, apiEp, accesstoken
  ) => {
    const { userConf } = this.props;
    const baseUrl = `${userConf.swapp_endpoint}/decserver/entries/direct/ftl/1/0/0/`;
    const res = await fetch(`${baseUrl}${cusCiqNo}.pdf`);
    const fileRes = await res.json();
    // datauri转File
    const pdfStr = fileRes.data.pdf;
    const byteString = window.atob(pdfStr); // base64 解码
    const arrayBuffer = new ArrayBuffer(byteString.length); // 创建缓冲数组
    const intArray = new Uint8Array(arrayBuffer); // 创建视图
    for (let i = 0; i < byteString.length; i++) {
      intArray[i] = byteString.charCodeAt(i);
    }
    const filename = `报关单${entryId}.pdf`;
    const file = new window.File([intArray], filename, { type: 'application/pdf' });
    const formData = new window.FormData();
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
    formData.append('data', JSON.stringify(docData));
    formData.append('file', file);
    const queryUrl = new URL(`${apiEp}/v1/saas/openapi/upload`);
    queryUrl.searchParams.append('token', accesstoken);
    const queryRes = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'X-WELO-CORS-ALLOW': true,
      },
      body: formData,
    });
    const resJson = await queryRes.json();
    const postUrl = new URL(`${apiEp}/v1/sw/decl/entry`);
    postUrl.searchParams.append('token', accesstoken);
    await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WELO-CORS-ALLOW': true,
      },
      body: JSON.stringify({
        declHead: {
          entry_id: entryId,
          ccd_file: resJson.data.doc_cdnurl,
        },
        updateDecl: true, // 仅更新declHead
      }),
    });
  }

  handleDownloadDocus = async (preDecDocVo, apiEp, accesstoken) => {
    const { userConf } = this.props;
    const baseUrl = `${userConf.swapp_endpoint}/decserver/sw/doc/cus/download/`;
    for (let i = 0; i < preDecDocVo.length; i++) {
      const attachDoc = preDecDocVo[i];
      const edocId = attachDoc.attEdocId;
      if (edocId) {
        // 下载单据文件
        const res = await fetch(`${baseUrl}${edocId}`);
        const blob = await res.blob();
        // 转为file(直接传递blob解析出文件流filename为'blob', mimeType为'application/octet-stream')
        // 插入文件名后续解析可从part中取,mimeType转为application/pdf
        const fileRes = new window.File([blob], attachDoc.entOrigFileName, { type: 'application/pdf' });
        const formData = new window.FormData();
        formData.append('att_edoc_id', edocId);
        formData.append('file', fileRes);
        // 上传单据文件至微骆系统
        const queryUrl = new URL(`${apiEp}/v1/sw/decl/docu`);
        queryUrl.searchParams.append('', accesstoken);
        await fetch(queryUrl, {
          method: 'POST',
          headers: {
            // 不能显式的添加multipart的content_type，否则使用cobusboy解析时报错 multipart: boundary not found
            // 'Content-Type': 'multipart/form-data',
            'X-WELO-CORS-ALLOW': true,
          },
          body: formData,
        });
      }
    }
  }

  handleWeloCusdeclScrape = async () => {
    const { userConf, onWeloWillLogin } = this.props;
    if (!userConf.weloapp.accesstoken) {
      onWeloWillLogin(true);
    } else {
      const cusDeclDataSource = { ...this.state.cusDeclDataSource };
      this.setState({ scraping: true });
      const pages = Math.ceil(cusDeclDataSource.total / cusDeclDataSource.pageSize);
      let newcookie;
      for (let i = 0; i < pages; i++) {
        const listQRes = {
          data: {
            rows: this.scrapedCusDeclCache.slice(
              i * cusDeclDataSource.pageSize,
              (i + 1) * cusDeclDataSource.pageSize,
            ),
          },
        };
        cusDeclDataSource.current = i + 1;
        for (let j = 0; j < listQRes.data.rows.length; j++) {
          const dr = listQRes.data.rows[j];
          dr.scrapeFg = 1;
          cusDeclDataSource.list[j] = dr;
          this.setState({ cusDeclDataSource });
          let drCusData = await this.handleCusDeclDetailPost(dr.cusCiqNo, newcookie);
          if (drCusData.error === 'swapp-cookie-expire') {
            newcookie = drCusData.cookie;
            drCusData = await this.handleCusDeclDetailPost(dr.cusCiqNo, newcookie);
          }
          if (drCusData.error) {
            message.error(drCusData.error, 10);
            cusDeclDataSource.list[j].scrapeFg = 0;
            this.setState({ cusDeclDataSource });
          } else if (drCusData.data.preDecHeadVo.entryId) {
            const postWelo = await this.postCusDataForWelo(
              drCusData.data,
              userConf.weloapp.accesstoken,
              userConf.welo_endpoint,
            );
            if (!postWelo.error) {
              cusDeclDataSource.list[j].scrapeFg = 2;
              this.setState({ cusDeclDataSource });
            } else {
              message.error(postWelo.error, 10);
              cusDeclDataSource.list[j].scrapeFg = 0;
              this.setState({ cusDeclDataSource });
            }
          }
        }
      }
      this.setState({ scraping: false });
    }
  };

  render() {
    const {
      searchDateRange,
      ieFlag,
      operType,
      dclTrnRelFlag,
      searchUnifiedNo,
      searchEntryId,
      cusDeclDataSource,
      listLoading,
      etpsCategory,
      scraping,
      scrapeCached,
    } = this.state;
    const weloScrapeBtn = { disabled: true };
    const swSearchBtn = { disabled: false, type: 'primary' };
    if (cusDeclDataSource.list.length > 0) {
      weloScrapeBtn.disabled = false;
      if (!scrapeCached) {
        weloScrapeBtn.type = 'primary';
        swSearchBtn.type = undefined;
      }
    }
    const disabled = operType !== '0';
    return (
      <div>
        <Form className="ant-advanced-search-form" layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="操作类型" {...formItemLayout}>
                <Select
                  onChange={this.handleOperTypeChange}
                  value={operType}
                  style={{ width: '100%' }}
                >
                  {operTypeList.map(f => (
                    <Option value={f.codeValue} key={f.codeValue}>
                      {f.codeName}
                    </Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="进出口标志" {...formItemLayout}>
                <RadioGroup
                  buttonStyle="solid"
                  value={ieFlag}
                  onChange={this.handleIeFlagChange}
                >
                  <RadioButton value="A" key="A">
                    全部
                  </RadioButton>
                  <RadioButton value="I" key="I">
                    进口
                  </RadioButton>
                  <RadioButton value="E" key="E">
                    出口
                  </RadioButton>
                </RadioGroup>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="报关单类型" {...formItemLayout}>
                <Select
                  mode="multiple"
                  onChange={this.handleDclTrnRelFlagChange}
                  value={dclTrnRelFlag}
                  style={{ width: '100%' }}
                  disabled={disabled}
                >
                  {dclTrnRelFlagList.map(f => (
                    <Option value={f.codeValue} key={f.codeValue}>
                      {f.codeName}
                    </Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="企业类别" {...formItemLayout}>
                <Select
                  onChange={this.handleEptCategorySel}
                  value={etpsCategory}
                  style={{ width: '100%' }}
                  disabled={disabled}
                >
                  {etpsCategoryList.map(etpsc => (
                    <Option value={etpsc.codeValue} key={etpsc.codeValue}>
                      {etpsc.codeName}
                    </Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="筛选时间" {...formItemLayout}>
                <DateRangeSelect
                  value={searchDateRange}
                  onChange={this.handleDateRangeChange}
                  disabled={disabled}
                />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="统一编号" {...formItemLayout}>
                <Input
                  value={searchUnifiedNo}
                  data-field="searchUnifiedNo"
                  onChange={this.handleEvValueChange}
                />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="海关编号" {...formItemLayout}>
                <Input
                  value={searchEntryId}
                  data-field="searchEntryId"
                  onChange={this.handleEvValueChange}
                  disabled={operType === '1'}
                />
              </FormItem>
            </Col>
            <Col span={12}>
              <Button
                icon="search"
                onClick={this.handleSwCusDeclSearch}
                {...swSearchBtn}
                disabled={scraping}
              >
                查询
              </Button>
            </Col>
          </Row>
        </Form>
        <DataTable
          columns={this.columns}
          showToolbar={false}
          dataSource={cusDeclDataSource.list}
          onChange={this.handleTableChange}
          loading={listLoading}
          rowKey="cusCiqNo"
          pagination={{
            total: cusDeclDataSource.total,
            current: cusDeclDataSource.current,
            pageSize: cusDeclDataSource.pageSize,
            showQuickJumper: true,
            showSizeChanger: true,
            pageSizeOptions: ['20', '40', '60', '80'],
            showTotal: total => `共${total}条`,
          }}
          scrollOffset={432}
        />
        <div className="bottom-bar">
          <Button
            {...weloScrapeBtn}
            size="large"
            icon="cloud-sync"
            loading={scraping}
            onClick={this.handleWeloCusdeclScrape}
          >
            同步到微骆云
          </Button>
        </div>
      </div>
    );
  }
}
