/* eslint-disable react/destructuring-assignment */
/* eslint-disable consistent-return */
import React from 'react';
import { Button, Input, Form, Spin, Progress, message, Row, Col, Select } from 'antd';
import moment from 'moment';
import DataTable from '../components/DataTable';
import DateRangeSelect from '../components/dateRangeSelect';

const FormItem = Form.Item;
const { Option } = Select;

const decModTypeList = [
  { decModTypeName: '修改申请', decModType: '1' },
  { decModTypeName: '撤销申请', decModType: '2' },
];

export default class DecModPane extends React.Component {
  state = {
    decModDataSource: {
      total: 0,
      pageSize: 20,
      current: 1,
      list: [],
    },
    decModType: undefined,
    decModTypeName: undefined,
    searchDateRange: [moment().subtract(30, 'days'), moment()],
    searchUnifiedNo: undefined,
    searchEntryId: undefined,
    listLoading: false,
    scraping: false,
    scrapeCached: false,
  };

  scrapedDecModCache = [];

  columns = [
    {
      title: '修撤申请单编号',
      dataIndex: 'decModSeqNo',
      width: 150,
    },
    {
      title: '申请单类型',
      dataIndex: 'decModTypeName',
      width: 100,
    },
    {
      title: '报关单号',
      dataIndex: 'entryId',
      width: 160,
    },
    {
      title: '报关单统一编号',
      dataIndex: 'cusCiqNo',
      width: 160,
    },
    {
      title: '境内收发货人',
      dataIndex: 'consigneeCname',
      width: 240,
    },
    {
      title: '申报单位',
      dataIndex: 'applWkunitName',
      width: 240,
    },
    {
      title: '单据状态',
      dataIndex: 'decModStatusName',
      width: 100,
    },
    {
      title: '操作日期',
      dataIndex: 'updateTime',
      width: 100,
    },
    {
      title: '是否发送超时',
      dataIndex: 'timeOutFlagName',
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

  handleDateRangeChange = (dateRange) => {
    if (dateRange && dateRange.length === 2 && dateRange[0].diff(dateRange[1], 'days') < -180) {
      message.error('时间范围不可大于180天');
      return;
    }
    this.setState({ searchDateRange: dateRange });
  };

  handleEvValueChange = (ev) => {
    const targetNode = ev.target;
    this.setState({ [targetNode.dataset.field]: targetNode.value });
  };

  handleDecModTypeSel = (decModType) => {
    const decMod = decModTypeList.find(dm => dm.decModType === decModType);
    this.setState({ decModType });
    this.setState({ decModTypeName: decMod.decModTypeName });
  };

  handleDecModQuery = async (limit, offsetPage, swcookie) => {
    const { userConf } = this.props;
    const {
      searchUnifiedNo,
      searchEntryId,
      searchDateRange,
      decModType,
      decModTypeName,
    } = this.state;
    if (!searchDateRange) {
      message.warn('请选择筛选日期范围，不超过180天');
    }
    const decModCondition = {
      decModType,
      decModTypeName,
      cusCiqNo: searchUnifiedNo,
      entryId: searchEntryId || '',
      modAffirmDate: null,
      modAffirmDateEnd: null,
    };
    if (searchDateRange && searchDateRange.length > 0) {
      decModCondition.modAffirmDate = searchDateRange[0].format('YYYY-MM-DD');
      decModCondition.modAffirmDateEnd = searchDateRange[1].format('YYYY-MM-DD');
    }
    const offset = offsetPage < 0 ? 0 : offsetPage * limit;
    const queryParam = {
      limit,
      offset,
      fromCondition: encodeURI(encodeURI(JSON.stringify(decModCondition))),
    };
    const queryUrl = new URL(`${userConf.swapp_endpoint}/decmmodserver/sw/mmod/queryRevokeList`);
    Object.keys(queryParam).forEach(key => queryUrl.searchParams.append(key, queryParam[key]));
    const res = await fetch(queryUrl, {
      headers: {
        cookie: swcookie || userConf.swapp.cookie,
      },
    });
    const commParsedRes = this.props.onParseSwappResult(res);
    if (commParsedRes) {
      return commParsedRes;
    }
    const resData = await res.json();
    if (resData.message) {
      return { error: resData.message };
    }
    return { error: null, data: resData };
  };

  handleLoadDecModTable = async (pageSize, currentPage, cacheInvalidate, swcookie) => {
    this.setState({ listLoading: true });
    const decModDataSource = { ...this.state.decModDataSource };
    const currentPageParam = currentPage || decModDataSource.current;
    const pageSizeParam = pageSize || decModDataSource.pageSize;
    const queryRes = await this.handleDecModQuery(pageSizeParam, currentPageParam - 1, swcookie);
    const nextState = { listLoading: false };
    if (queryRes.error) {
      if (queryRes.error === 'swapp-cookie-expire') {
        await this.handleLoadDecModTable(pageSize, currentPage, cacheInvalidate, queryRes.cookie);
      } else {
        message.error(queryRes.error);
      }
    } else {
      if (cacheInvalidate) {
        nextState.scrapeCached = false;
        this.scrapedDecModCache = [];
      }
      decModDataSource.total = Number(queryRes.data.total);
      decModDataSource.list = queryRes.data.rows;
      decModDataSource.current = currentPageParam;
      decModDataSource.pageSize = pageSizeParam;
      nextState.decModDataSource = decModDataSource;
    }
    this.setState(nextState);
  };

  handleSwDecModSearch = async () => {
    await this.handleLoadDecModTable(null, 1, true);
    const { decModType } = this.state;
    this.props.onSessionSave({ decModType });
  };

  handleTableChange = async (pagination) => {
    const { scrapeCached } = this.state;
    const { pageSize, current } = pagination;
    if (!scrapeCached) {
      await this.handleLoadDecModTable(pageSize, current);
    } else {
      const decModDataSource = { ...this.state.decModDataSource };
      decModDataSource.list = this.scrapedDecModCache.slice(
        (current - 1) * pageSize,
        current * pageSize,
      );
      decModDataSource.current = current;
      decModDataSource.pageSize = pageSize;
      this.setState({ decModDataSource });
    }
  };

  handleSwSearchReset = () => {
    this.setState({
      searchDateRange: [moment().subtract(30, 'days'), moment()],
      searchUnifiedNo: undefined,
      searchEntryId: undefined,
    });
  };

  handleDecModDetailPost = async (decModSeqNo, swcookie) => {
    const { userConf } = this.props;
    const queryParam = { decModSeqNo };
    const queryUrl = new URL(`${userConf.swapp_endpoint}/decmmodserver/sw/cus/mod/queryDecMod`);
    Object.keys(queryParam).forEach(key => queryUrl.searchParams.append(key, queryParam[key]));
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: swcookie || userConf.swapp.cookie,
      },
      body: JSON.stringify({ decModSeqNo }),
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

  postModDataForWelo = async (modData, accesstoken, apiEp) => {
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
    const postRes = await fetch(`${apiEp}/v1/sw/decl/mod`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WELO-CORS-ALLOW': true,
      },
      body: JSON.stringify({
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
        token: accesstoken,
      }),
    });
    if (postRes.ok && postRes.status === 200) {
      try {
        const postResJson = await postRes.json();
        return { error: postResJson.err_msg || postResJson.err_code };
      } catch (err) {
        return { error: err.message };
      }
    }
    return { error: postRes.statusText };
  };

  handleWeloDecModScrape = async () => {
    const { userConf, onWeloWillLogin } = this.props;
    const { scrapeCached } = this.state;
    if (!userConf.weloapp.accesstoken) {
      onWeloWillLogin(true);
    } else {
      const decModDataSource = { ...this.state.decModDataSource };
      this.setState({ scraping: true });
      const pages = Math.ceil(decModDataSource.total / decModDataSource.pageSize);
      let newcookie;
      for (let i = 0; i < pages; i++) {
        let listQRes;
        if (pages === 1) {
          listQRes = { data: { rows: decModDataSource.list } };
        } else if (scrapeCached) {
          listQRes = {
            data: {
              rows: this.scrapedDecModCache.slice(
                i * decModDataSource.pageSize,
                (i + 1) * decModDataSource.pageSize,
              ),
            },
          };
        } else {
          listQRes = await this.handleDecModQuery(decModDataSource.pageSize, i);
          if (listQRes.error === 'swapp-cookie-expire') {
            // while (listQRes.error === 'swapp-cookie-expire') {
            newcookie = listQRes.cookie;
            listQRes = await this.handleDecModQuery(decModDataSource.pageSize, i, newcookie);
            // }
          }
          if (listQRes.error) {
            message.error(listQRes.error, 10);
            this.setState({ scraping: false });
            return;
          }
        }
        decModDataSource.current = i + 1;
        for (let j = 0; j < listQRes.data.rows.length; j++) {
          const dr = listQRes.data.rows[j];
          dr.scrapeFg = 1;
          decModDataSource.list[j] = dr;
          this.setState({ decModDataSource });
          let drCusData = await this.handleDecModDetailPost(dr.decModSeqNo, newcookie);
          if (drCusData.error === 'swapp-cookie-expire') {
            newcookie = drCusData.cookie;
            drCusData = await this.handleDecModDetailPost(dr.decModSeqNo, newcookie);
          }
          if (drCusData.error) {
            message.error(drCusData.error, 10);
            this.setState({ scraping: false });
            return;
          }
          const postWelo = await this.postModDataForWelo(
            drCusData.data,
            userConf.weloapp.accesstoken,
            userConf.welo_endpoint,
          );
          if (!postWelo.error) {
            decModDataSource.list[j].scrapeFg = 2;
            this.setState({ decModDataSource });
            if (!scrapeCached) {
              this.scrapedDecModCache.push(dr);
            }
          } else {
            message.error(postWelo.error, 10);
            decModDataSource.list[j].scrapeFg = 0;
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
      searchEntryId,
      searchUnifiedNo,
      decModDataSource,
      listLoading,
      decModType,
      scraping,
      scrapeCached,
    } = this.state;
    const weloScrapeBtn = { disabled: true };
    const swSearchBtn = { disabled: false, type: 'primary' };
    if (decModDataSource.list.length > 0) {
      weloScrapeBtn.disabled = false;
      if (!scrapeCached) {
        weloScrapeBtn.type = 'primary';
        swSearchBtn.type = undefined;
      }
    }
    return (
      <div>
        <Form className="ant-advanced-search-form" layout="vertical">
          <Row gutter={16}>
            <Col span={5}>
              <FormItem label="申请单类型">
                <Select
                  allowClear
                  onChange={this.handleDecModTypeSel}
                  value={decModType}
                  style={{ width: '100%' }}
                >
                  {decModTypeList.map(decMod => (
                    <Option value={decMod.decModType} key={decMod.decModType}>
                      {decMod.decModTypeName}
                    </Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={6}>
              <FormItem label="筛选时间">
                <DateRangeSelect
                  value={searchDateRange}
                  onChange={this.handleDateRangeChange}
                />
              </FormItem>
            </Col>
            <Col span={5}>
              <FormItem label="报关单统一编号">
                <Input
                  value={searchUnifiedNo}
                  data-field="searchUnifiedNo"
                  onChange={this.handleEvValueChange}
                />
              </FormItem>
            </Col>
            <Col span={5}>
              <FormItem label="报关单号">
                <Input
                  value={searchEntryId}
                  data-field="searchEntryId"
                  onChange={this.handleEvValueChange}
                />
              </FormItem>
            </Col>
            <Col span={3} style={{ paddingTop: 28 }}>
              <Button
                icon="search"
                onClick={this.handleSwDecModSearch}
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
          dataSource={decModDataSource.list}
          onChange={this.handleTableChange}
          loading={listLoading}
          rowKey="decModSeqNo"
          pagination={{
            total: decModDataSource.total,
            current: decModDataSource.current,
            pageSize: decModDataSource.pageSize,
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
            onClick={this.handleWeloDecModScrape}
          >
            同步到微骆云
          </Button>
        </div>
      </div>
    );
  }
}
