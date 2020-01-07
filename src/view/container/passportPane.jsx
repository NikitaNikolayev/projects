import React from 'react';
import { Button, Input, Form, Spin, Progress, message, Row, Col, Select } from 'antd';
import moment from 'moment';
import DataTable from '../components/DataTable';
import DateRangeSelect from '../components/dateRangeSelect';

const FormItem = Form.Item;
const { Option } = Select;

export default class PassportPane extends React.Component {
  state = {
    passportDataSource: {
      total: 0,
      pageSize: 20,
      current: 1,
      list: [],
    },
    searchDateRange: [moment().subtract(7, 'days'), moment()],
    searchSeqNo: undefined,
    searchPassNo: undefined,
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
      title: '核放单编号',
      dataIndex: 'passportNo',
      width: 180,
    },
    {
      title: '企业内部编号',
      dataIndex: 'etpsPreentNo',
      width: 160,
    },
    {
      title: '核放单类型',
      dataIndex: 'passportTypecdName',
      width: 150,
    },
    {
      title: '进出标志',
      dataIndex: 'ioTypecdName',
      width: 80,
    },
    {
      title: '数据状态',
      dataIndex: 'stucdName',
      width: 120,
    },
    {
      title: '区内企业名称',
      dataIndex: 'areainEtpsNm',
      width: 240,
      render: (consignee, row) => [consignee, row.rcvgdTradeScc].filter(cns => cns).join('|'),
    },
    {
      title: '绑定类型',
      dataIndex: 'bindTypecdName',
      width: 100,
    },
    {
      title: '关联单证号',
      dataIndex: 'rltNo',
      width: 200,
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
      title: '是否过卡',
      dataIndex: 'passStucdName',
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

  handlePassportQuery = async (swcookie) => {
    const { userConf } = this.props;
    const { searchSeqNo, searchPassNo, searchDateRange, selTradeCode } = this.state;
    const reqBody = {
      status: '',
      selTradeCode,
      bindTypecd: '',
      passportTypecd: '',
      rltTbTypecd: '',
      rltNo: '',
      seqNo: searchSeqNo || '',
      passportNo: searchPassNo || '',
      areainEtpsno: '',
      etpsPreentNo: '',
      areainEtpsNo: '',
      vehicleNo: '',
      inputDateStart: null,
      inputDateEnd: null,
      sysId: 'Z7',
      inputCode: selTradeCode,
    };
    if (searchDateRange && searchDateRange.length > 0) {
      reqBody.inputDateStart = searchDateRange[0].format('YYYYMMDD');
      reqBody.inputDateEnd = searchDateRange[1].format('YYYYMMDD');
    }
    const queryUrl = new URL(
      `${userConf.swapp_endpoint}/sasserver/sw/ems/pub/passport/Z7/passPortQueryListService`,
    );
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

  handleLoadPassportTable = async (pageSize, currentPage, cacheInvalidate, swcookie) => {
    this.setState({ listLoading: true });
    const passportDataSource = { ...this.state.passportDataSource };
    const currentPageParam = currentPage || passportDataSource.current;
    const pageSizeParam = pageSize || passportDataSource.pageSize;
    const queryRes = await this.handlePassportQuery(swcookie);
    const nextState = { listLoading: false };
    if (queryRes.error) {
      if (queryRes.error === 'swapp-cookie-expire') {
        await this.handleLoadPassportTable(pageSize, currentPage, cacheInvalidate, queryRes.cookie);
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
        passportDataSource.total = Number(resultList.length);
        passportDataSource.list = resultList;
      }
      passportDataSource.current = currentPageParam;
      passportDataSource.pageSize = pageSizeParam;
      nextState.passportDataSource = passportDataSource;
    }
    this.setState(nextState);
  };

  handleSwPassportSearch = async () => {
    await this.handleLoadPassportTable(null, null, true);
    const { selTradeCode } = this.state;
    this.props.onSessionSave({ selTradeCode });
  };

  handleTableChange = async (pagination) => {
    const { scrapeCached } = this.state;
    const { pageSize, current } = pagination;
    if (!scrapeCached) {
      await this.handleLoadPassportTable(pageSize, current);
    } else {
      const passportDataSource = { ...this.state.passportDataSource };
      passportDataSource.list = this.scrapedPassportCache.slice(
        (current - 1) * pageSize,
        current * pageSize,
      );
      passportDataSource.current = current;
      passportDataSource.pageSize = pageSize;
      this.setState({ passportDataSource });
    }
  };

  handlePassportDetailPost = async (seqNo, swcookie) => {
    const { userConf } = this.props;
    const { selTradeCode } = this.state;
    const queryUrl = `${userConf.swapp_endpoint}/sasserver/sw/ems/pub/passport/Z8/passPortDetailService`;
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: swcookie || userConf.swapp.cookie,
      },
      body: JSON.stringify({ seqNo, operCusRegCode: selTradeCode }),
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

  postPassportDataForWelo = async (passData, accesstoken, apiEp) => {
    const postRes = await fetch(`${apiEp}/v1/sw/passport/sas221`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WELO-CORS-ALLOW': true,
      },
      body: JSON.stringify({
        passHead: passData,
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

  handleWeloPassportScrape = async () => {
    const { userConf, onWeloWillLogin } = this.props;
    const { scrapeCached } = this.state;
    if (!userConf.weloapp.accesstoken) {
      onWeloWillLogin(true);
    } else {
      const passportDataSource = { ...this.state.passportDataSource };
      this.setState({ scraping: true });
      const pages = Math.ceil(passportDataSource.total / passportDataSource.pageSize);
      let newcookie;
      let reloadPassPortList = [];
      for (let i = 0; i < pages; i++) {
        let listQRes;
        if (pages === 1) {
          listQRes = { data: { rows: passportDataSource.list } };
        } else if (scrapeCached) {
          listQRes = {
            data: {
              rows: this.scrapedPassportCache.slice(
                i * passportDataSource.pageSize,
                (i + 1) * passportDataSource.pageSize,
              ),
            },
          };
        } else {
          if (reloadPassPortList.length === 0) {
            let loadPassRes = await this.handlePassportQuery();
            if (loadPassRes.error === 'swapp-cookie-expire') {
              newcookie = loadPassRes.cookie;
              loadPassRes = await this.handlePassportQuery(newcookie);
            }
            if (loadPassRes.error) {
              message.error(loadPassRes.error, 0);
              this.setState({ scraping: false });
              return;
            }
            reloadPassPortList = loadPassRes.data.data.resultList;
          }
          listQRes = {
            data: {
              rows: reloadPassPortList.slice(
                i * passportDataSource.pageSize,
                (i + 1) * passportDataSource.pageSize,
              ),
            },
          };
        }
        passportDataSource.current = i + 1;
        for (let j = 0; j < listQRes.data.rows.length; j++) {
          const row = listQRes.data.rows[j];
          row.scrapeFg = 1;
          passportDataSource.list[passportDataSource.pageSize * i + j] = row;
          this.setState({ passportDataSource });
          let drCusData = await this.handlePassportDetailPost(row.seqNo, newcookie);
          if (drCusData.error === 'swapp-cookie-expire') {
            newcookie = drCusData.cookie;
            drCusData = await this.handlePassportDetailPost(row.seqNo, newcookie);
          }
          if (drCusData.error) {
            message.error(drCusData.error, 0);
            this.setState({ scraping: false });
            return;
          }
          const postWelo = await this.postPassportDataForWelo(
            drCusData.data.passportHead,
            userConf.weloapp.accesstoken,
            userConf.welo_endpoint,
          );
          if (!postWelo.error) {
            passportDataSource.list[passportDataSource.pageSize * i + j].scrapeFg = 2;
            this.setState({ passportDataSource });
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
      searchPassNo,
      passportDataSource,
      listLoading,
      selTradeCode,
      scraping,
      scrapeCached,
    } = this.state;
    const weloScrapeBtn = { disabled: true };
    const swSearchBtn = { disabled: false, type: 'primary' };
    if (passportDataSource.list.length > 0) {
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
              <FormItem label="核放单编号">
                <Input
                  value={searchPassNo}
                  data-field="searchPassNo"
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
                onClick={this.handleSwPassportSearch}
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
          dataSource={passportDataSource.list}
          onChange={this.handleTableChange}
          loading={listLoading}
          rowKey="seqNo"
          pagination={{
            total: passportDataSource.total,
            current: passportDataSource.current,
            pageSize: passportDataSource.pageSize,
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
            onClick={this.handleWeloPassportScrape}
          >
            同步到微骆云
          </Button>
        </div>
      </div>
    );
  }
}
