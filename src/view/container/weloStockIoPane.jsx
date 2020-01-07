import React from 'react';
import { Button, Form, Spin, Progress, message, Row, Col, Select, Input, Tooltip } from 'antd';
import DataTable from '../components/DataTable';

const FormItem = Form.Item;
const { Option } = Select;
const WRAP_TYPE_V1 = [
  {
    text: '木箱',
    value: '1',
    value_v2: '23',
  },
  {
    text: '纸箱',
    value: '2',
    value_v2: '22',
  },
  {
    text: '桶装',
    value: '3',
    value_v2: '32',
  },
  {
    text: '散装',
    value: '4',
    value_v2: '00',
  },
  {
    text: '托盘',
    value: '5',
    value_v2: '92',
  },
  {
    text: '包',
    value: '6',
    value_v2: '06',
  },
  {
    text: '其它',
    value: '7',
    value_v2: '99',
  },
];
function getStockBizType(value) {
  const BAPPL_BIZTYPE = {
    A: '分送集报',
    B: '外发加工',
    C: '保税展示交易',
    D: '设备检测',
    E: '设备维修',
    F: '模具外发',
    G: '简单加工',
    H: '其他业务',
    Y: '一纳企业进出区',
  };
  return BAPPL_BIZTYPE[value];
}
function getWrapType(value) {
  for (let i = 0; i < WRAP_TYPE_V1.length; i++) {
    const type = WRAP_TYPE_V1[i];
    if (value === type.value || value === type.value_v2) {
      return type.text;
    }
  }
  return value;
}
export default class WeloStockIoPane extends React.Component {
  state = {
    weloStockIoDataSource: {
      total: 0,
      pageSize: 20,
      current: 1,
      list: [],
    },
    listLoading: false,
    scraping: false,
    tradeList: [],
    searchNo: '',
  };

  scrapedStockIoCache = [];

  columns = [
    {
      title: '企业内部编号',
      dataIndex: 'cop_stock_no',
      width: 120,
    },
    {
      title: '订单追踪号',
      dataIndex: 'cust_order_no',
      width: 120,
    },
    {
      title: '业务类型',
      dataIndex: 'stock_biztype',
      width: 90,
      render: o => getStockBizType(o),
    },
    {
      title: '账册编号',
      dataIndex: 'blbook_no',
      width: 120,
    },
    {
      title: '申报表编号',
      dataIndex: 'sasbl_apply_no',
      width: 120,
    },
    {
      title: '件数',
      dataIndex: 'sio_pieces',
      width: 60,
    },
    {
      title: '包装',
      dataIndex: 'sio_wrap_type',
      width: 100,
      render: o => getWrapType(o),
    },
    {
      title: '出入库单类型',
      dataIndex: 'stock_ioflag',
      width: 120,
      render: (o) => {
        if (o === 1) {
          return 'I-进区';
        }
        return 'E-出区';
      },
    },
    {
      title: '数据状态',
      dataIndex: 'stock_status',
      width: 100,
      render: o => `${o}-未申报`,
    },
    {
      title: '区内企业名称',
      dataIndex: 'owner_name',
      width: 240,
      render: (o, row) => [o, row.owner_cus_code].filter(cns => cns).join('|'),
    },
    {
      title: '申报类型',
      dataIndex: 'stock_dectype',
      width: 100,
      render: (o) => {
        if (o === '1') {
          return '备案';
        }
        return '作废';
      },
    },
    {
      title: '集中报关标志',
      dataIndex: 'batdecl_no',
      width: 100,
      render: (o) => {
        if (o) {
          return `已集报${o}`;
        }
        return '未集报';
      },
    },
    {
      dataIndex: 'OPS_COL',
      className: 'table-col-ops',
      width: 50,
      fixed: 'right',
      render: (_, row) => {
        if (row.sent_status === 0) {
          if (!row.sio_pieces || !row.sio_wrap_type) {
            return (
              <Tooltip title="件数/包装未填写">
                <Button size="small" disabled>
                  发送暂存
                </Button>
              </Tooltip>
            );
          }
          return (
            <Button size="small" type="primary" onClick={() => this.handleSwSentStock(row)}>
              发送暂存
            </Button>
          );
        }
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
    if (swapp && swapp.userinfo) {
      this.setState({
        tradeList: [{ codeValue: swapp.userinfo.cus_reg_no, codeName: swapp.userinfo.etps_name }],
        selTradeCode: swapp.selTradeCode,
      });
    }
  }

  componentWillReceiveProps(nextProps) {
    const thisSwApp = this.props.userConf.swapp;
    const nextSwApp = nextProps.userConf.swapp;
    if (nextSwApp.selTradeCode && nextSwApp.selTradeCode !== thisSwApp.selTradeCode) {
      this.setState({ selTradeCode: nextSwApp.selTradeCode });
    }
  }

  handleTradeSel = (selTradeCode) => {
    this.setState({ selTradeCode });
  };

  handleLoadStockGoods = async (copStockNo) => {
    const { userConf } = this.props;
    const apiEp = userConf.welo_endpoint;
    const postRes = await fetch(`${apiEp}/v1/sw/stockio/stockdetails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WELO-CORS-ALLOW': true,
      },
      body: JSON.stringify({
        : userConf.weloapp.accesstoken,
        copStockNo,
      }),
    });
    if (postRes.ok && postRes.status === 200) {
      try {
        const postResJson = await postRes.json();
        return postResJson.data;
      } catch (err) {
        return { error: err.message };
      }
    } else {
      message.error(postRes.statusText);
      return { error: postRes.statusText };
    }
  };

  handleFillPreSeqNo = async (copStockNo, preSeqNo) => {
    const { userConf } = this.props;
    const apiEp = userConf.welo_endpoint;
    const postRes = await fetch(`${apiEp}/v1/sw/stockio/fillstockstatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WELO-CORS-ALLOW': true,
      },
      body: JSON.stringify({
        stockHead: {
          cop_stock_no: copStockNo,
          pre_sasbl_seqno: preSeqNo,
        },
        status: '0',
        token: userConf.weloapp.accesstoken,
      }),
    });
    if (postRes.ok && postRes.status === 200) {
      return {};
    }
    return { error: postRes.statusText };
  };

  handlePostSwStock = async (stock, stockGoods, swcookie) => {
    const { userConf } = this.props;
    const queryUrl = new URL(`${userConf.swapp_endpoint}/sasserver/sw/ems/pub/stock/Z8/save`);
    const reqBody = {
      status: '',
      stockGoods: stockGoods.map(gd => ({
        sasStockSeqno: gd.stockio_goods_seqno,
        sasDclSeqno: gd.apply_seq_no,
        oriactGdsSeqno: gd.prdt_item_no,
        gdsMtno: gd.sgd_product_no,
        gdecd: gd.sgd_hscode,
        gdsNm: gd.sgd_name,
        gdsSpcfModelDesc: gd.sgd_model,
        dclUnitcd: gd.sgd_g_unit,
        dclCurrcd: gd.sgd_currency,
        dclQty: gd.sgd_g_qty,
        dclUprcAmt: gd.sgd_dec_price,
        dclTotalAmt: gd.sgd_amount,
        lawfUnitcd: gd.sgd_unit_1,
        secdLawfUnitcd: gd.sgd_unit_2,
        lawfQty: gd.sgd_qty_1,
        secdLawfQty: gd.sgd_qty_2,
        ucnsVerno: gd.uconsumption_no,
        clyMarkcd: '',
        wtSfVal: gd.sgd_wt_factor,
        fstSfVal: gd.sgd_factor1,
        secdSfVal: gd.sgd_factor2,
        grossWt: gd.sgd_grosswt,
        netWt: gd.sgd_netwt,
        rltGdsSeqno: gd.stockio_rlt_goods_seqno,
        natcd: gd.sgd_orig_country,
        destinationNatcd: gd.sgd_dest_country,
        lvyrlfModecd: gd.sgd_duty_mode,
        col1: 0,
        rmk: gd.sgd_remark,
      })),
      stockHead: {
        areainEtpsNm: stock.owner_name,
        areainEtpsNo: stock.owner_cus_code,
        areainEtpsSccd: stock.owner_scc_code,
        areainOriactNo: stock.blbook_no,
        businessTypecd: stock.stock_biztype,
        businessTypecdText: getStockBizType(stock.stock_biztype),
        centralizeGeTypecd: '1',
        centralizeGeTypecdText: '',
        dclEr: stock.declarer_person,
        dclEtpsNm: stock.declarer_name,
        dclEtpsNo: stock.declarer_cus_code,
        dclEtpsSccd: stock.declarer_scc_code,
        dclTime: '',
        dclTypecd: stock.stock_dectype,
        dclTypecdText: '',
        eportReplaceMark: '',
        etpsPreentNo: stock.cop_stock_no,
        grossWt: stock.sio_grosswt,
        inputCode: stock.typing_cus_code,
        inputDate: stock.created_date,
        inputName: stock.typing_name,
        inputSccd: stock.typing_scc_code,
        masterCuscd: stock.master_customs,
        masterCuscdText: '',
        mtpckEndprdTypecd: stock.prdgoods_mark,
        mtpckEndprdTypecdText: '',
        netWt: stock.sio_netwt,
        packType: stock.sio_wrap_type,
        packTypeText: '',
        packageQty: stock.sio_pieces,
        passTypecd: '',
        rltBondInvtNo: stock.rlt_invtreg_no,
        rltSasStockNo: stock.rlt_stockio_no,
        rmk: stock.sio_remark,
        sasDclNo: stock.sasbl_apply_no,
        sasStockNo: '',
        seqNo: '',
        stockTypecd: stock.stock_ioflag === 2 ? 'E' : 'I',
        stockTypecdText: '',
      },
    };
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: swcookie || userConf.swapp.cookie,
      },
      body: JSON.stringify(reqBody),
    });
    const commParsedRes = this.props.onParseSwappResult(res);
    if (commParsedRes) {
      return commParsedRes;
    }
    const resData = await res.json();
    if (resData.code && resData.code !== 0) {
      return { error: resData.message };
    }
    return { error: null, data: resData };
  };

  handleSwSentStock = async (stock, swcookie) => {
    try {
      const stockGoodsRes = await this.handleLoadStockGoods(stock.cop_stock_no);
      if (!stockGoodsRes.error) {
        const queryRes = await this.handlePostSwStock(stock, stockGoodsRes, swcookie);
        if (queryRes.error) {
          if (queryRes.error === 'swapp-cookie-expire') {
            await this.handleSwSentStock(stock, queryRes.cookie);
          } else {
            message.error(queryRes.error);
          }
        } else {
          const fillSeqNoRes = await this.handleFillPreSeqNo(
            stock.cop_stock_no, queryRes.data.data.preNo
          );
          if (!fillSeqNoRes.error) {
            await this.handleLoadWeloStockIoTable();
            message.success('操作成功');
          }
        }
      } else {
        message.error(stockGoodsRes.error);
      }
    } catch (err) {
      message.error(err.message);
    }
  };

  handleLoadWeloStockIoTable = async (pageSize, currentPage) => {
    const { userConf, onWeloWillLogin } = this.props;
    const { searchNo } = this.state;
    if (!userConf.weloapp.accesstoken) {
      onWeloWillLogin(true);
    } else {
      this.setState({ listLoading: true, scraping: true });
      const apiEp = userConf.welo_endpoint;
      const { socialCreditCode: sccCode, cus_reg_no: cusCode } = userConf.swapp.userinfo;
      const weloStockIoDataSource = { ...this.state.weloStockIoDataSource };
      const currentPageParam = currentPage || weloStockIoDataSource.current;
      const pageSizeParam = pageSize || weloStockIoDataSource.pageSize;
      const postRes = await fetch(`${apiEp}/v1/sw/stockio/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WELO-CORS-ALLOW': true,
        },
        body: JSON.stringify({
          token: userConf.weloapp.accesstoken,
          currentPageParam,
          pageSizeParam,
          sccCode,
          cusCode,
          searchNo,
        }),
      });
      const nextState = { listLoading: false, scraping: false };
      if (postRes.ok && postRes.status === 200) {
        try {
          const postResJson = await postRes.json();
          if (postResJson.data) {
            weloStockIoDataSource.total = Number(postResJson.data.totalCount);
            weloStockIoDataSource.list = postResJson.data.rows;
            weloStockIoDataSource.current = currentPageParam;
            weloStockIoDataSource.pageSize = pageSizeParam;
            nextState.weloStockIoDataSource = weloStockIoDataSource;
          } else {
            message.error(postResJson.msg, 10);
          }
        } catch (err) {
          message.error(err.message);
        }
      } else {
        message.error(postRes.statusText);
      }
      this.setState(nextState);
    }
  };

  handleWeloStockIoSearch = async () => {
    await this.handleLoadWeloStockIoTable(null, null);
    const { selTradeCode } = this.state;
    this.props.onSessionSave({ selTradeCode });
  };

  handleTableChange = async (pagination) => {
    const { pageSize, current } = pagination;
    await this.handleLoadWeloStockIoTable(pageSize, current);
  };

  handleSearchInputChange = (ev) => {
    const targetNode = ev.target;
    this.setState({ [targetNode.dataset.field]: targetNode.value });
  };

  render() {
    const { weloStockIoDataSource, listLoading, selTradeCode, scraping, searchNo } = this.state;
    return (
      <div>
        <Form className="ant-advanced-search-form" layout="vertical">
          <Row gutter={8}>
            <Col span={6}>
              <FormItem label="查询企业" required>
                <Select
                  onChange={this.handleTradeSel}
                  value={selTradeCode}
                  style={{ width: '100%' }}
                >
                  {this.state.tradeList.map(trade => (
                    <Option value={trade.codeValue} key={trade.codeValue}>
                      {trade.codeName}
                    </Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={6}>
              <FormItem label="订单追踪号/内部编号">
                <Input
                  value={searchNo}
                  data-field="searchNo"
                  onChange={this.handleSearchInputChange}
                />
              </FormItem>
            </Col>
            <Col span={4} style={{ paddingTop: 28 }}>
              <Button
                icon="search"
                onClick={this.handleWeloStockIoSearch}
                type="primary"
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
          dataSource={weloStockIoDataSource.list}
          onChange={this.handleTableChange}
          loading={listLoading}
          rowKey="seqNo"
          pagination={{
            total: weloStockIoDataSource.total,
            current: weloStockIoDataSource.current,
            pageSize: weloStockIoDataSource.pageSize,
            showQuickJumper: true,
            showSizeChanger: true,
            pageSizeOptions: ['20', '40', '60', '80'],
            showTotal: total => `共${total}条`,
          }}
          scrollOffset={432}
        />
      </div>
    );
  }
}
