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

// const tradeList = [{ codeName: '上海新捷洋进出口有限公司', codeValue: '3109965222' }]; // TODO

export default class InvtRegPane extends React.Component {
  state = {
    invtRegDataSource: {
      total: 0,
      pageSize: 20,
      current: 1,
      list: [],
    },
    ieFlag: 'I',
    selTradeCode: null,
    searchDateRange: [moment().subtract(7, 'days'), moment()],
    searchSeqNo: undefined,
    searchInvtNo: undefined,
    listLoading: false,
    scraping: false,
    scrapeCached: false,
    tradeList: [],
  };

  scrapedInvtRegCache = [];

  columns = [
    {
      title: '预录入统一编号',
      dataIndex: 'seqNo',
      width: 160,
    },
    {
      title: '清单编号',
      dataIndex: 'bondInvtNo',
      width: 160,
    },
    {
      title: '清单类型',
      dataIndex: 'bondInvtTypeName',
      width: 90,
    },
    {
      title: '手/账册编号',
      dataIndex: 'putrecNo',
      width: 150,
    },
    {
      title: '数据状态',
      dataIndex: 'listStatName',
      width: 150,
    },
    {
      title: '核扣标志',
      dataIndex: 'vrfdedMarkcdName',
      width: 100,
    },
    {
      title: '经营单位',
      dataIndex: 'bizopEtpsNM',
      width: 240,
      render: (consignee, row) => [consignee, row.rcvgdTradeScc].filter(cns => cns).join('|'),
    },
    {
      title: '加工单位',
      dataIndex: 'rcvgdEtpsNM',
      width: 240,
      render: (consignee, row) => [consignee, row.rcvgdTradeScc].filter(cns => cns).join('|'),
    },
    {
      title: '进出口口岸',
      dataIndex: 'impexpPortCDName',
      width: 100,
    },
    {
      title: '监管方式',
      dataIndex: 'supvModeCDName',
      width: 100,
    },
    {
      title: '申报日期',
      dataIndex: 'invtDclTime',
      width: 100,
    },
    {
      title: '申报类型',
      dataIndex: 'dclTypecdName',
      width: 80,
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

  handleIeFlagChange = (radev) => {
    this.setState({ ieFlag: radev.target.value });
  };

  handleTradeSel = (selTradeCode) => {
    this.setState({ selTradeCode });
  };

  handleInvtRegQuery = async (limit, offsetPage, swcookie) => {
    const { userConf } = this.props;
    const { ieFlag, searchSeqNo, searchInvtNo, searchDateRange, selTradeCode } = this.state;
    const reqBody = {
      selTradeCode: selTradeCode || '',
      impExpMarkCd: ieFlag || 'I',
      seqNo: searchSeqNo || '',
      bondInvtNo: searchInvtNo || '',
      inputDateStart: null,
      inputDateEnd: null,
    };
    if (searchDateRange && searchDateRange.length > 0) {
      reqBody.inputDateStart = searchDateRange[0].format('YYYYMMDD');
      reqBody.inputDateEnd = searchDateRange[1].format('YYYYMMDD');
    }
    const queryUrl = new URL(`${userConf.swapp_endpoint}/sasserver/sw/ems/invt/Bws/list`);
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
    return { error: null, data: resData };
  };

  handleLoadInvtRegTable = async (pageSize, currentPage, cacheInvalidate, swcookie) => {
    this.setState({ listLoading: true });
    const invtRegDataSource = { ...this.state.invtRegDataSource };
    const currentPageParam = currentPage || invtRegDataSource.current;
    const pageSizeParam = pageSize || invtRegDataSource.pageSize;
    const queryRes = await this.handleInvtRegQuery(pageSizeParam, currentPageParam - 1, swcookie);
    const nextState = { listLoading: false };
    if (queryRes.error) {
      if (queryRes.error === 'swapp-cookie-expire') {
        await this.handleLoadInvtRegTable(pageSize, currentPage, cacheInvalidate, queryRes.cookie);
      } else {
        message.error(queryRes.error);
      }
    } else {
      if (cacheInvalidate) {
        nextState.scrapeCached = false;
        this.scrapedInvtRegCache = [];
      }
      const { resultList } = queryRes.data.data;
      if (resultList) {
        invtRegDataSource.total = Number(resultList.length);
        invtRegDataSource.list = resultList;
      }
      invtRegDataSource.current = currentPageParam;
      invtRegDataSource.pageSize = pageSizeParam;
      nextState.invtRegDataSource = invtRegDataSource;
    }
    this.setState(nextState);
  };

  handleSwInvtRegSearch = async () => {
    await this.handleLoadInvtRegTable(null, null, true);
    const { selTradeCode } = this.state;
    this.props.onSessionSave({ selTradeCode });
  };

  handleTableChange = async (pagination) => {
    const { scrapeCached } = this.state;
    const { pageSize, current } = pagination;
    if (!scrapeCached) {
      await this.handleLoadInvtRegTable(pageSize, current);
    } else {
      const invtRegDataSource = { ...this.state.invtRegDataSource };
      invtRegDataSource.list = this.scrapedInvtRegCache.slice(
        (current - 1) * pageSize,
        current * pageSize,
      );
      invtRegDataSource.current = current;
      invtRegDataSource.pageSize = pageSize;
      this.setState({ invtRegDataSource });
    }
  };

  handleSwSearchReset = () => {
    this.setState({
      searchDateRange: null,
      searchSeqNo: undefined,
      searchInvtNo: undefined,
    });
  };

  handleInvtRegDetailPost = async (seqNo, swcookie) => {
    const { userConf } = this.props;
    const queryUrl = `${userConf.swapp_endpoint}/sasserver/sw/ems/invt/Bws/details/${seqNo}`;
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: swcookie || userConf.swapp.cookie,
      },
    });
    const commParsedRes = this.props.onParseSwappResult(res);
    if (commParsedRes) {
      return commParsedRes;
    }
    const resJson = await res.json();
    if (resJson.code && resJson.code !== 0) {
      return { error: resJson.message };
    }
    return { error: null, data: resJson.data };
  };

  postInvtDataForWelo = async (invtData, accesstoken, apiEp) => {
    const postRes = await fetch(`${apiEp}/v1/sw/invbsc/inv201`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WELO-CORS-ALLOW': true,
      },
      body: JSON.stringify({
        invtHeadType: invtData.invtHeadType,
        invtListType: invtData.invtListType,
        decUnifiedNo: invtData.invtDecListType[0] && invtData.invtDecListType[0].decSeqNo,
        listStat: invtData.listStat,
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

  handleWeloInvtRegScrape = async () => {
    const { userConf, onWeloWillLogin } = this.props;
    const { scrapeCached } = this.state;
    if (!userConf.weloapp.access) {
      onWeloWillLogin(true);
    } else {
      const invtRegDataSource = { ...this.state.invtRegDataSource };
      this.setState({ scraping: true });
      const pages = Math.ceil(invtRegDataSource.total / invtRegDataSource.pageSize);
      let newcookie;
      let reloadStockList = [];
      for (let i = 0; i < pages; i++) {
        let listQRes;
        if (pages === 1) {
          listQRes = { data: { rows: invtRegDataSource.list } };
        } else if (scrapeCached) {
          listQRes = {
            data: {
              rows: this.scrapedInvtRegCache.slice(
                i * invtRegDataSource.pageSize,
                (i + 1) * invtRegDataSource.pageSize,
              ),
            },
          };
        } else {
          if (reloadStockList.length === 0) {
            listQRes = await this.handleInvtRegQuery(invtRegDataSource.pageSize, i);
            if (listQRes.error === 'swapp-cookie-expire') {
              // while (listQRes.error === 'swapp-cookie-expire') {
              newcookie = listQRes.cookie;
              listQRes = await this.handleInvtRegQuery(invtRegDataSource.pageSize, i, newcookie);
              // }
            }
            if (listQRes.error) {
              message.error(listQRes.error, 0);
              this.setState({ scraping: false });
              return;
            }
            reloadStockList = listQRes.data.data.resultList;
          }
          listQRes = {
            data: {
              rows: reloadStockList.slice(
                i * invtRegDataSource.pageSize,
                (i + 1) * invtRegDataSource.pageSize,
              ),
            },
          };
        }
        invtRegDataSource.current = i + 1;
        for (let j = 0; j < listQRes.data.rows.length; j++) {
          const row = listQRes.data.rows[j];
          row.scrapeFg = 1;
          invtRegDataSource.list[invtRegDataSource.pageSize * i + j] = row;
          this.setState({ invtRegDataSource });
          let drCusData = await this.handleInvtRegDetailPost(row.seqNo, newcookie);
          if (drCusData.error === 'swapp-cookie-expire') {
            newcookie = drCusData.cookie;
            drCusData = await this.handleInvtRegDetailPost(row.seqNo, newcookie);
          }
          if (drCusData.error) {
            message.error(drCusData.error, 0);
            this.setState({ scraping: false });
            return;
          }
          const postWelo = await this.postInvtDataForWelo(
            drCusData.data,
            userConf.weloapp.accesstoken,
            userConf.welo_endpoint,
          );
          if (!postWelo.error) {
            invtRegDataSource.list[invtRegDataSource.pageSize * i + j].scrapeFg = 2;
            this.setState({ invtRegDataSource });
            if (!scrapeCached) {
              this.scrapedInvtRegCache.push(row);
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
      ieFlag,
      searchSeqNo,
      searchInvtNo,
      invtRegDataSource,
      listLoading,
      selTradeCode,
      scraping,
      scrapeCached,
    } = this.state;
    const weloScrapeBtn = { disabled: true };
    const swSearchBtn = { disabled: false, type: 'primary' };
    if (invtRegDataSource.list.length > 0) {
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
              <FormItem label="进出口类型" required>
                <RadioGroup
                  buttonStyle="solid"
                  value={ieFlag}
                  onChange={this.handleIeFlagChange}
                >
                  <RadioButton value="I" key="I">
                    进口
                  </RadioButton>
                  <RadioButton value="E" key="E">
                    出口
                  </RadioButton>
                </RadioGroup>
              </FormItem>
            </Col>
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
            <Col span={4}>
              <FormItem label="预录入统一编号">
                <Input
                  value={searchSeqNo}
                  data-field="searchSeqNo"
                  onChange={this.handleEvValueChange}
                />
              </FormItem>
            </Col>
            <Col span={4}>
              <FormItem label="清单编号">
                <Input
                  value={searchInvtNo}
                  data-field="searchInvtNo"
                  onChange={this.handleEvValueChange}
                />
              </FormItem>
            </Col>
            <Col span={5}>
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
                onClick={this.handleSwInvtRegSearch}
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
          dataSource={invtRegDataSource.list}
          onChange={this.handleTableChange}
          loading={listLoading}
          rowKey="seqNo"
          pagination={{
            total: invtRegDataSource.total,
            current: invtRegDataSource.current,
            pageSize: invtRegDataSource.pageSize,
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
            onClick={this.handleWeloInvtRegScrape}
          >
            同步到微骆云
          </Button>
        </div>
      </div>
    );
  }
}
