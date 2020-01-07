import React from 'react';
import { Button, Input, Form, Spin, Progress, message, Row, Col, Select } from 'antd';
import moment from 'moment';
import DataTable from '../components/DataTable';
import DateRangeSelect from '../components/dateRangeSelect';

const FormItem = Form.Item;
const { Option } = Select;

export default class StockIoPane extends React.Component {
  state = {
    stockIoDataSource: {
      total: 0,
      pageSize: 20,
      current: 1,
      list: [],
    },
    searchDateRange: [moment().subtract(7, 'days'), moment()],
    searchSeqNo: undefined,
    searchStockNo: undefined,
    listLoading: false,
    scraping: false,
    scrapeCached: false,
    tradeList: [],
  };

  scrapedStockIoCache = [];

  columns = [
    {
      title: '序号',
      dataIndex: 'indexNo',
      width: 45,
      align: 'center',
      render: (col, row, index) => index + 1,
    },
    {
      title: '预录入统一编号',
      dataIndex: 'seqNo',
      width: 160,
    },
    {
      title: '出入库单编号',
      dataIndex: 'sasStockNo',
      width: 160,
    },
    {
      title: '企业内部编号',
      dataIndex: 'etpsPreentNo',
      width: 160,
    },
    {
      title: '业务类型',
      dataIndex: 'businessTypecdName',
      width: 90,
    },
    {
      title: '出入库单类型',
      dataIndex: 'stockTypecdName',
      width: 120,
    },
    {
      title: '数据状态',
      dataIndex: 'statusName',
      width: 150,
    },
    {
      title: '区内企业名称',
      dataIndex: 'areainEtpsNm',
      width: 240,
      render: (consignee, row) => [consignee, row.rcvgdTradeScc].filter(cns => cns).join('|'),
    },
    {
      title: '核放单预录入编号',
      dataIndex: 'passportNo',
      width: 160,
    },
    {
      title: '申报日期',
      dataIndex: 'dclTime',
      width: 100,
    },
    {
      title: '申报类型',
      dataIndex: 'dclTypecdName',
      width: 100,
    },
    {
      title: '集中报关标志',
      dataIndex: 'centralizedDclTypecdName',
      width: 100,
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

  handleTradeSel = (selTradeCode) => {
    this.setState({ selTradeCode });
  };

  handleStockIoQuery = async (swcookie, current, pageSize) => {
    const { userConf } = this.props;
    const { searchSeqNo, searchStockNo, searchDateRange, selTradeCode } = this.state;
    const reqBody = {
      limit: pageSize,
      offset: (current - 1) * pageSize,
      order: 'asc',
      stockQueryListRequest: {
        status: '',
        selTradeCode,
        dclTypecd: '',
        stockTypecd: '',
        seqNo: searchSeqNo || '',
        sasStockNo: searchStockNo || '',
        sasDclNo: '',
        areainEtpsno: '',
        etpsPreentNo: '',
        inputDateStart: null,
        inputDateEnd: null,
        inputCode: selTradeCode,
      },
    };
    if (searchDateRange && searchDateRange.length > 0) {
      reqBody.stockQueryListRequest.inputDateStart = searchDateRange[0].format('YYYYMMDD');
      reqBody.stockQueryListRequest.inputDateEnd = searchDateRange[1].format('YYYYMMDD');
    }
    const queryUrl = new URL(`${userConf.swapp_endpoint}/sasserver/sw/ems/pub/stock/Z8/query`);
    // Object.keys(queryParam).forEach(key => queryUrl.searchParams.append(key, queryParam[key]));
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
    return { error: null, data: resData.data };
  };

  handleLoadStockIoTable = async (pageSize, currentPage, cacheInvalidate, swcookie) => {
    this.setState({ listLoading: true });
    const stockIoDataSource = { ...this.state.stockIoDataSource };
    const currentPageParam = currentPage || stockIoDataSource.current;
    const pageSizeParam = pageSize || stockIoDataSource.pageSize;
    const queryRes = await this.handleStockIoQuery(swcookie, currentPageParam, pageSizeParam);
    const nextState = { listLoading: false };
    if (queryRes.error) {
      if (queryRes.error === 'swapp-cookie-expire') {
        await this.handleLoadStockIoTable(pageSize, currentPage, cacheInvalidate, queryRes.cookie);
      } else {
        message.error(queryRes.error);
      }
    } else {
      if (cacheInvalidate) {
        nextState.scrapeCached = false;
        this.scrapedStockIoCache = [];
      }
      if (queryRes.data) {
        stockIoDataSource.total = Number(queryRes.data.total);
        stockIoDataSource.list = queryRes.data.rows;
      }
      stockIoDataSource.current = currentPageParam;
      stockIoDataSource.pageSize = pageSizeParam;
      nextState.stockIoDataSource = stockIoDataSource;
    }
    this.setState(nextState);
  };

  handleSwStockIoSearch = async () => {
    await this.handleLoadStockIoTable(null, null, true);
    const { selTradeCode } = this.state;
    this.props.onSessionSave({ selTradeCode });
  };

  handleTableChange = async (pagination) => {
    const { scrapeCached } = this.state;
    const { pageSize, current } = pagination;
    if (!scrapeCached) {
      await this.handleLoadStockIoTable(pageSize, current);
    } else {
      const stockIoDataSource = { ...this.state.stockIoDataSource };
      stockIoDataSource.list = this.scrapedStockIoCache.slice(
        (current - 1) * pageSize,
        current * pageSize,
      );
      stockIoDataSource.current = current;
      stockIoDataSource.pageSize = pageSize;
      this.setState({ stockIoDataSource });
    }
  };

  handleSwSearchReset = () => {
    this.setState({
      searchDateRange: null,
      searchSeqNo: undefined,
      searchStockNo: undefined,
    });
  };

  postStockIoDataForWelo = async (stockHead, accesstoken, apiEp) => {
    const stockHeadWo = {
      pre_sasbl_seqno: stockHead.seqNo,
      stock_dectype: stockHead.dclTypecd,
      stock_decl_date: stockHead.dclTime,
      cop_stock_no: stockHead.etpsPreentNo,
      stock_no: stockHead.sasStockNo,
      pass_typecd: stockHead.passTypecd,
    };
    const postRes = await fetch(`${apiEp}/v1/sw/stockio/fillstockstatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WELO-CORS-ALLOW': true,
      },
      body: JSON.stringify({
        stockHead: stockHeadWo,
        status: stockHead.status,
        token: accesstoken,
      }),
    });
    if (postRes.ok && postRes.status === 200) {
      try {
        const postResJson = await postRes.json();
        return { error: postResJson.err_msg };
      } catch (err) {
        return { error: err.message };
      }
    }

    return { error: postRes.statusText };
  };

  handleWeloStockIoScrape = async () => {
    const { userConf, onWeloWillLogin } = this.props;
    const { scrapeCached } = this.state;
    if (!userConf.weloapp.accesstoken) {
      onWeloWillLogin(true);
    } else {
      const stockIoDataSource = { ...this.state.stockIoDataSource };
      const { pageSize, total } = stockIoDataSource;
      this.setState({ scraping: true });
      const pages = Math.ceil(total / pageSize);
      let newcookie;
      for (let i = 0; i < pages; i++) {
        let listQRes;
        if (pages === 1) {
          listQRes = { data: { rows: stockIoDataSource.list } };
        } else if (scrapeCached) {
          listQRes = {
            data: {
              rows: this.scrapedStockIoCache.slice(
                i * pageSize,
                (i + 1) * pageSize,
              ),
            },
          };
        } else {
          let loadStockRes = await this.handleStockIoQuery(null, i + 1, pageSize);
          if (loadStockRes.error === 'swapp-cookie-expire') {
            // while (listQRes.error === 'swapp-cookie-expire') {
            newcookie = loadStockRes.cookie;
            loadStockRes = await this.handleStockIoQuery(newcookie, i + 1, pageSize);
            // }
          }
          if (loadStockRes.error) {
            message.error(loadStockRes.error, 0);
            this.setState({ scraping: false });
            return;
          }
          listQRes = {
            data: {
              rows: loadStockRes.data.rows,
            },
          };
        }
        stockIoDataSource.current = i + 1;
        for (let j = 0; j < listQRes.data.rows.length; j++) {
          const row = listQRes.data.rows[j];
          row.scrapeFg = 1;
          stockIoDataSource.list[pageSize * i + j] = row;
          this.setState({ stockIoDataSource });
          const postWelo = await this.postStockIoDataForWelo(
            row,
            userConf.weloapp.accesstoken,
            userConf.welo_endpoint,
          );
          if (!postWelo.error) {
            stockIoDataSource.list[pageSize * i + j].scrapeFg = 2;
            this.setState({ stockIoDataSource });
            if (!scrapeCached) {
              this.scrapedStockIoCache.push(row);
            }
          } else {
            message.error(postWelo.error, 0);
            this.setState({ scraping: false });
            return;
          }
        }
        this.setState({ scraping: false, scrapeCached: true });
      }
    }
  };

  render() {
    const {
      searchDateRange,
      searchSeqNo,
      searchStockNo,
      stockIoDataSource,
      listLoading,
      selTradeCode,
      scraping,
      scrapeCached,
    } = this.state;
    const weloScrapeBtn = { disabled: true };
    const swSearchBtn = { disabled: false, type: 'primary' };
    if (stockIoDataSource.list.length > 0) {
      weloScrapeBtn.disabled = false;
      if (!scrapeCached) {
        weloScrapeBtn.type = 'primary';
        swSearchBtn.type = undefined;
      }
    }
    return (
      <div>
        <Form className="ant-advanced-search-form" layout="vertical">
          <Row gutter={8}>
            <Col span={4}>
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
            <Col span={5}>
              <FormItem label="预录入统一编号">
                <Input
                  value={searchSeqNo}
                  data-field="searchSeqNo"
                  onChange={this.handleEvValueChange}
                />
              </FormItem>
            </Col>
            <Col span={5}>
              <FormItem label="出入库单编号">
                <Input
                  value={searchStockNo}
                  data-field="searchStockNo"
                  onChange={this.handleEvValueChange}
                />
              </FormItem>
            </Col>
            <Col span={7}>
              <FormItem label="筛选时间">
                <DateRangeSelect
                  value={searchDateRange}
                  onChange={this.handleDateRangeChange}
                />
              </FormItem>
            </Col>
            <Col span={3} style={{ paddingTop: 28 }}>
              <Button
                icon="search"
                onClick={this.handleSwStockIoSearch}
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
          dataSource={stockIoDataSource.list}
          onChange={this.handleTableChange}
          loading={listLoading}
          rowKey="seqNo"
          pagination={{
            total: stockIoDataSource.total,
            current: stockIoDataSource.current,
            pageSize: stockIoDataSource.pageSize,
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
            onClick={this.handleWeloStockIoScrape}
          >
            同步到微骆云
          </Button>
        </div>
      </div>
    );
  }
}
