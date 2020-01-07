import React from 'react';
import { Button, DatePicker, Input, Form, Spin, Progress, message, Row, Col, Select } from 'antd';
import moment from 'moment';
import DataTable from '../components/DataTable';

const FormItem = Form.Item;
const { RangePicker } = DatePicker;
const { Option } = Select;

export default class BizapplPane extends React.Component {
  state = {
    bizapplDataSource: {
      total: 0,
      pageSize: 20,
      current: 1,
      list: [],
    },
    searchDateRange: [moment().subtract(7, 'days'), moment()],
    searchSeqNo: undefined,
    sasDclNo: undefined,
    listLoading: false,
    scraping: false,
    scrapeCached: false,
    tradeList: [],
  };

  scrapedPassportCache = [];

  columns = [
    {
      title: '预录入统一编号',
      dataIndex: 'seqNo',
      width: 160,
    },
    {
      title: '申报表编号',
      dataIndex: 'sasDclNo',
      width: 180,
    },
    {
      title: '企业内部编号',
      dataIndex: 'etpsInnerInvtNo',
      width: 160,
    },
    {
      title: '业务类型',
      dataIndex: 'businessTypecdName',
      width: 150,
    },
    {
      title: '申报类型',
      dataIndex: 'dclTypecdName',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'statusName',
      width: 120,
    },
    {
      title: '区内企业名称',
      dataIndex: 'areainEtpsNm',
      width: 240,
    },
    {
      title: '申报日期',
      dataIndex: 'dclTime',
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

  handleBizapplQuery = async (swcookie) => {
    const { userConf } = this.props;
    const { searchSeqNo, sasDclNo, searchDateRange, selTradeCode } = this.state;
    const reqBody = {
      areainEtpsno: '',
      businessTypecd: '',
      businessTypecdName: '',
      etpsInnerInvtNo: '',
      inputCode: selTradeCode,
      inputDateStart: null,
      inputDateEnd: null,
      sasDclNo: sasDclNo || null,
      selTradeCode,
      seqNo: searchSeqNo,
      status: '',
      statusName: '全部',
      sysId: 'Z8',
    };
    if (searchDateRange && searchDateRange.length > 0) {
      reqBody.inputDateStart = searchDateRange[0].format('YYYYMMDD');
      reqBody.inputDateEnd = searchDateRange[1].format('YYYYMMDD');
    }
    const queryUrl = new URL(
      `${userConf.swapp_endpoint}/sasserver/sw/ems/pub/app/Z8/appQueryListService`,
    );
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

  handleLoadBizapplTable = async (pageSize, currentPage, cacheInvalidate, swcookie) => {
    this.setState({ listLoading: true });
    const bizapplDataSource = { ...this.state.bizapplDataSource };
    const currentPageParam = currentPage || bizapplDataSource.current;
    const pageSizeParam = pageSize || bizapplDataSource.pageSize;
    const queryRes = await this.handleBizapplQuery(swcookie);
    const nextState = { listLoading: false };
    if (queryRes.error) {
      if (queryRes.error === 'swapp-cookie-expire') {
        await this.handleLoadBizapplTable(pageSize, currentPage, cacheInvalidate, queryRes.cookie);
      } else {
        message.error(queryRes.error);
      }
    } else {
      if (cacheInvalidate) {
        nextState.scrapeCached = false;
        this.scrapedPassportCache = [];
      }
      const { resultList } = queryRes.data.data;
      if (resultList) {
        bizapplDataSource.total = Number(resultList.length);
        bizapplDataSource.list = resultList;
      }
      bizapplDataSource.current = currentPageParam;
      bizapplDataSource.pageSize = pageSizeParam;
      nextState.bizapplDataSource = bizapplDataSource;
    }
    this.setState(nextState);
  };

  handleSwBizapplSearch = async () => {
    await this.handleLoadBizapplTable(null, null, true);
    const { selTradeCode } = this.state;
    this.props.onSessionSave({ selTradeCode });
  };

  handleTableChange = async (pagination) => {
    const { scrapeCached } = this.state;
    const { pageSize, current } = pagination;
    if (!scrapeCached) {
      await this.handleLoadBizapplTable(pageSize, current);
    } else {
      const bizapplDataSource = { ...this.state.bizapplDataSource };
      bizapplDataSource.list = this.scrapedPassportCache.slice(
        (current - 1) * pageSize,
        current * pageSize,
      );
      bizapplDataSource.current = current;
      bizapplDataSource.pageSize = pageSize;
      this.setState({ bizapplDataSource });
    }
  };

  handleBizapplDetailPost = async (seqNo, swcookie) => {
    const { userConf } = this.props;
    const { selTradeCode } = this.state;
    const queryUrl = `${
      userConf.swapp_endpoint
    }/sasserver/sw/ems/pub/app/Z8/applyDetailService`;
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: swcookie || userConf.swapp.cookie,
      },
      body: JSON.stringify({ seqNo, operCusRegCode: selTradeCode, sysId: 'Z8' }),
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

  postBizapplDataForWelo = async (appHead, status, accesstoken, apiEp) => {
    const postRes = await fetch(`${apiEp}/v1/sw/bizappl/sas201`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WELO-CORS-ALLOW': true,
      },
      body: JSON.stringify({
        appHead,
        status,
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

  handleWeloBizapplScrape = async () => {
    const { userConf, onWeloWillLogin } = this.props;
    const { scrapeCached } = this.state;
    if (!userConf.weloapp.accesstoken) {
      onWeloWillLogin(true);
    } else {
      const bizapplDataSource = { ...this.state.bizapplDataSource };
      this.setState({ scraping: true });
      const pages = Math.ceil(bizapplDataSource.total / bizapplDataSource.pageSize);
      let newcookie;
      let reloadBizapplList = [];
      for (let i = 0; i < pages; i++) {
        let listQRes;
        if (pages === 1) {
          listQRes = { data: { rows: bizapplDataSource.list } };
        } else if (scrapeCached) {
          listQRes = {
            data: {
              rows: this.scrapedPassportCache.slice(
                i * bizapplDataSource.pageSize,
                (i + 1) * bizapplDataSource.pageSize,
              ),
            },
          };
        } else {
          if (reloadBizapplList.length === 0) {
            let loadBizRes = await this.handleBizapplQuery();
            if (loadBizRes.error === 'swapp-cookie-expire') {
              newcookie = loadBizRes.cookie;
              loadBizRes = await this.handleBizapplQuery(newcookie);
            }
            if (loadBizRes.error) {
              message.error(loadBizRes.error, 0);
              this.setState({ scraping: false });
              return;
            }
            reloadBizapplList = loadBizRes.data.data.resultList;
          }
          listQRes = {
            data: {
              rows: reloadBizapplList.slice(
                i * bizapplDataSource.pageSize,
                (i + 1) * bizapplDataSource.pageSize,
              ),
            },
          };
        }
        bizapplDataSource.current = i + 1;
        for (let j = 0; j < listQRes.data.rows.length; j++) {
          const row = listQRes.data.rows[j];
          row.scrapeFg = 1;
          bizapplDataSource.list[bizapplDataSource.pageSize * i + j] = row;
          this.setState({ bizapplDataSource });
          let drCusData = await this.handleBizapplDetailPost(row.seqNo, newcookie);
          if (drCusData.error === 'swapp-cookie-expire') {
            newcookie = drCusData.cookie;
            drCusData = await this.handleBizapplDetailPost(row.seqNo, newcookie);
          }
          if (drCusData.error) {
            message.error(drCusData.error, 0);
            this.setState({ scraping: false });
            return;
          }
          const postWelo = await this.postBizapplDataForWelo(
            drCusData.data.appHead,
            drCusData.data.status,
            userConf.weloapp.accesstoken,
            userConf.welo_endpoint,
          );
          if (!postWelo.error) {
            bizapplDataSource.list[bizapplDataSource.pageSize * i + j].scrapeFg = 2;
            this.setState({ bizapplDataSource });
            if (!scrapeCached) {
              this.scrapedPassportCache.push(row);
            }
          } else {
            message.error(postWelo.error, 0);
            this.setState({ scraping: false });
            return;
          }
        }
      }
      this.setState({ scraping: false, scrapeCached: true });
    }
  };

  render() {
    const {
      searchDateRange,
      searchSeqNo,
      sasDclNo,
      bizapplDataSource,
      listLoading,
      selTradeCode,
      scraping,
      scrapeCached,
    } = this.state;
    const weloScrapeBtn = { disabled: true };
    const swSearchBtn = { disabled: false, type: 'primary' };
    if (bizapplDataSource.list.length > 0) {
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
              <FormItem label="申报表编号">
                <Input
                  value={sasDclNo}
                  data-field="sasDclNo"
                  onChange={this.handleEvValueChange}
                />
              </FormItem>
            </Col>
            <Col span={7}>
              <FormItem label="筛选时间">
                <RangePicker
                  value={searchDateRange}
                  ranges={{
                    今日: [moment(), moment()],
                    本月: [moment().startOf('month'), moment()],
                  }}
                  onChange={this.handleDateRangeChange}
                  format="YYYY-MM-DD"
                />
              </FormItem>
            </Col>
            <Col span={3} style={{ paddingTop: 28 }}>
              <Button
                icon="search"
                onClick={this.handleSwBizapplSearch}
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
          dataSource={bizapplDataSource.list}
          onChange={this.handleTableChange}
          loading={listLoading}
          rowKey="seqNo"
          pagination={{
            total: bizapplDataSource.total,
            current: bizapplDataSource.current,
            pageSize: bizapplDataSource.pageSize,
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
            onClick={this.handleWeloBizapplScrape}
          >
            同步到微骆云
          </Button>
        </div>
      </div>
    );
  }
}
