import React from 'react';
import { Button, Input, Form, Radio, Spin, Progress, message, Row, Col } from 'antd';
import moment from 'moment';
import DataTable from '../components/DataTable';
import DateRangeSelect from '../components/dateRangeSelect';

const FormItem = Form.Item;
const RadioButton = Radio.Button;
const RadioGroup = Radio.Group;

function getPaymentStatus(payStatus, transStatus) {
  // 1:未支付 2：支付失败 3：支付成功
  if (payStatus && payStatus === '0') {
    return 1;
  }
  if (transStatus && transStatus === 'X') {
    return 2;
  }
  if (transStatus && transStatus === 'S') {
    return 3;
  }
  return 0;
}

export default class TaxPayPane extends React.Component {
  state = {
    taxPayDataSource: {
      total: 0,
      pageSize: 20,
      current: 1,
      list: [],
    },
    payStatus: '3',
    searchDateRange: [moment().subtract(7, 'days'), moment()],
    searchEntryId: undefined,
    listLoading: false,
    scraping: false,
    scrapeCached: false,
  };

  scrapedTaxPayCache = [];

  columns = [
    {
      title: '报关单号',
      dataIndex: 'entryId',
      width: 160,
    },
    {
      title: '税单序号',
      dataIndex: 'taxId',
      width: 80,
      align: 'center',
    },
    {
      title: '税费单号',
      dataIndex: 'taxvouNo',
      width: 200,
    },
    {
      title: '税费种类',
      dataIndex: 'taxTypeName',
      width: 100,
      render: (o, record) => (
        <span>
          {record.taxType}
          {' '}
|
          {' '}
          {o}
        </span>
      ),
    },
    {
      title: '支付金额',
      dataIndex: 'traAmt',
      width: 120,
      align: 'right',
      render: (o, record) => o || record.realTax,
    },
    {
      title: '支付状态',
      dataIndex: 'transStatusName',
      width: 100,
      render: (o, record) => {
        if (o) {
          return o;
        }
        if (record.payStatus && record.payStatus === '0') {
          return '未支付';
        }
        return null;
      },
    },
    {
      title: '税单生成日期',
      dataIndex: 'genDateStr',
      width: 150,
    },
    {
      title: '税单支付时间',
      dataIndex: 'updateTimeStr',
      width: 150,
    },
    {
      title: '付款银行',
      dataIndex: 'paybkName',
      width: 150,
    },
    {
      title: '银行扣款时间',
      dataIndex: 'addTimeStr',
      width: 150,
    },
    {
      title: '汇总征税标志',
      dataIndex: 'extendField1',
      width: 100,
    },
    {
      title: '支付方式',
      dataIndex: 'payTypeStr',
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
    this.setState({
      payStatus: radev.target.value,
      taxPayDataSource: {
        total: 0,
        pageSize: 20,
        current: 1,
        list: [],
      },
    });
  };

  handleTaxPayQuery = async (limit, offsetPage, swcookie) => {
    const { userConf } = this.props;
    const { payStatus, searchEntryId, searchDateRange } = this.state;
    const unpaidCondition = {
      entryId: searchEntryId || '',
      taxId: '',
      billNo: '',
      contrNo: '',
      ownerName: '',
      taxType: '',
      declPort: '',
      extendField1: '',
      genDateStart: null,
      genDateEnd: null,
      transStatus: 'N',
    };
    const processCondition = {
      entryId: searchEntryId || '',
      taxId: '',
      billNo: '',
      contrNo: '',
      ownerName: '',
      taxType: '',
      declPort: '',
      transStatus: '',
      protocolNo: '',
      handOrgName: '',
      updateTimeStart: null,
      updateTimeEnd: null,
      isNeedCount: '1',
    };
    const paidCondition = {
      entryId: searchEntryId || '',
      taxId: '',
      billNo: '',
      contrNo: '',
      ownerName: '',
      taxType: '',
      declPort: '',
      handOrgName: '',
      protocolNo: '',
      dealTimeStart: null,
      dealTimeEnd: null,
      isNeedCount: '1',
    };
    if (searchDateRange && searchDateRange.length > 0) {
      unpaidCondition.genDateStart = searchDateRange[0].format('YYYY-MM-DD');
      unpaidCondition.genDateEnd = searchDateRange[1].format('YYYY-MM-DD');
      processCondition.updateTimeStart = searchDateRange[0].format('YYYY-MM-DD');
      processCondition.updateTimeEnd = searchDateRange[1].format('YYYY-MM-DD');
      paidCondition.dealTimeStart = searchDateRange[0].format('YYYY-MM-DD');
      paidCondition.dealTimeEnd = searchDateRange[1].format('YYYY-MM-DD');
    }
    let taxPayCondition = paidCondition;
    if (payStatus === '1') {
      taxPayCondition = unpaidCondition;
    } else if (payStatus === '2') {
      taxPayCondition = processCondition;
    }
    const offset = offsetPage < 0 ? 0 : offsetPage * limit;
    const queryParam = {
      limit,
      offset,
      fromCondition: JSON.stringify(taxPayCondition),
    };
    let queryUrl = new URL(
      `${userConf.swapp_endpoint}/splserver/spl/epiTaxOptimize/querySwHisEpiTaxSuccessRecodes`,
    );
    if (payStatus === '1') {
      queryUrl = new URL(
        `${userConf.swapp_endpoint}/splserver/spl/epiTaxOptimize/queryCusEpiTaxRecodes`,
      );
    } else if (payStatus === '2') {
      queryUrl = new URL(
        `${userConf.swapp_endpoint}/splserver/spl/epiTaxOptimize/querySwEpiTaxPreocessRecodes`,
      );
    }
    Object.keys(queryParam).forEach(key => queryUrl.searchParams.append(key, queryParam[key]));
    const res = await fetch(queryUrl, {
      headers: {
        cookie: swcookie || userConf.swapp.cookie,
        rdtime: userConf.swapp.userinfo.rdtime,
      },
    });
    const commParsedRes = this.props.onParseSwappResult(res);
    if (commParsedRes) {
      return commParsedRes;
    }
    const resData = await res.json();
    const resDataJson = JSON.parse(resData);
    if (resDataJson.errCode && resDataJson.errCode !== '100') {
      return { error: resDataJson.errMsg };
    }
    return { error: null, data: resDataJson };
  };

  handleLoadTaxPayTable = async (pageSize, currentPage, cacheInvalidate, swcookie) => {
    this.setState({ listLoading: true });
    const taxPayDataSource = { ...this.state.taxPayDataSource };
    const currentPageParam = currentPage || taxPayDataSource.current;
    const pageSizeParam = pageSize || taxPayDataSource.pageSize;
    const queryRes = await this.handleTaxPayQuery(pageSizeParam, currentPageParam - 1, swcookie);
    const nextState = { listLoading: false };
    if (queryRes.error) {
      if (queryRes.error === 'swapp-cookie-expire') {
        await this.handleLoadTaxPayTable(pageSize, currentPage, cacheInvalidate, queryRes.cookie);
      } else {
        message.error(queryRes.error);
      }
    } else {
      if (cacheInvalidate) {
        nextState.scrapeCached = false;
        this.scrapedTaxPayCache = [];
      }
      taxPayDataSource.total = Number(queryRes.data.unSafeBusinessData.total);
      taxPayDataSource.list = queryRes.data.unSafeBusinessData.rows;
      taxPayDataSource.current = currentPageParam;
      taxPayDataSource.pageSize = pageSizeParam;
      nextState.taxPayDataSource = taxPayDataSource;
    }
    this.setState(nextState);
  };

  handleSwTaxPaySearch = async () => {
    await this.handleLoadTaxPayTable(null, 1, true);
  };

  handleTableChange = async (pagination) => {
    const { scrapeCached } = this.state;
    const { pageSize, current } = pagination;
    if (!scrapeCached) {
      await this.handleLoadTaxPayTable(pageSize, current);
    } else {
      const taxPayDataSource = { ...this.state.taxPayDataSource };
      taxPayDataSource.list = this.scrapedTaxPayCache.slice(
        (current - 1) * pageSize,
        current * pageSize,
      );
      taxPayDataSource.current = current;
      taxPayDataSource.pageSize = pageSize;
      this.setState({ taxPayDataSource });
    }
  };

  handleSwSearchReset = () => {
    this.setState({
      searchDateRange: [moment().subtract(7, 'days'), moment()],
      searchEntryId: undefined,
    });
  };

  postTaxPaymentForWelo = async (declTaxPay, declTaxPayDt, accesstoken, apiEp) => {
    const taxPay = {};
    Object.keys(declTaxPay).forEach((tpKey) => {
      if (
        ['addTime', 'billDate', 'taxDate', 'entrustDate', 'updateTime',
          'transStatusName', 'transStatusStr', 'updateUser', 'limitDate',
          'iEDate',
        ].indexOf(tpKey) === -1
      ) {
        taxPay[tpKey] = declTaxPay[tpKey];
      }
    });
    const postRes = await fetch(`${apiEp}/v2/sw/tax/payanddetail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WELO-CORS-ALLOW': true,
      },
      body: JSON.stringify({
        taxPay,
        taxPayDts: declTaxPayDt,
        token: accesstoken,
      }),
    });
    if (postRes.ok && postRes.status === 200) {
      const postResJson = await postRes.json();
      if (declTaxPay.transStatus === 'S' && declTaxPay.swTaxId && postResJson.data && postResJson.data.printdoc) {
        this.handleTaxPrintDocUpload(declTaxPay.swTaxId, declTaxPay.taxvouNo);
      }
      return { error: postRes.msg || postResJson.err_code };
    }

    return { error: postRes.statusText };
  };

  handleTaxPrintDocUpload = async (swTaxId, taxvouNo) => {
    const { userConf } = this.props;
    const printdocUrl = `${userConf.swapp_endpoint}/splserver/spl/documentPrint/queryDocument`;
    const queryUrl = new URL(printdocUrl);
    const queryDocRes = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        rdtime: userConf.swapp.userinfo.rdtime,
      },
      body: JSON.stringify([{
        swTaxId,
        operationType: '1',
      }]),
    });
    const commParsedRes = this.props.onParseSwappResult(queryDocRes);
    if (commParsedRes) {
      return commParsedRes;
    }
    const resData = await queryDocRes.json();
    if (resData.errCode && resData.errCode !== '100') {
      return { error: resData.errMsg };
    }
    const { flag } = resData.unSafeBusinessData;
    const docviewUrl = `${userConf.swapp_endpoint}/splserver/spl/documentPrint/viewByFlag/${flag}.pdf`;
    const taxPdfRes = await fetch(docviewUrl);
    const blob = await taxPdfRes.blob();
    const fileRes = new window.File([blob], `${taxvouNo}.pdf`, { type: 'application/pdf' });
    const formData = new window.FormData();
    formData.append('data', JSON.stringify({
      billNo: taxvouNo,
      bizObject: 'cmsCustomsDecl',
      docType: -4,
    }));
    formData.append('file', fileRes);
    const weloUploadUrl = new URL(`${userConf.welo_endpoint}/v1/saas/openapi/upload`);
    weloUploadUrl.searchParams.append('token', userConf.weloapp.accesstoken);
    const queryRes = await fetch(weloUploadUrl, {
      method: 'POST',
      headers: {
        'X-WELO-CORS-ALLOW': true,
      },
      body: formData,
    });
    if (queryRes.ok && queryRes.status === 200) {
      const pdfUploadRes = await queryRes.json();
      const taxUpdateUrl = new URL(`${userConf.welo_endpoint}/v1/sw/tax/putpayment`);
      taxUpdateUrl.searchParams.append('token', userConf.weloapp.accesstoken);
      await fetch(taxUpdateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WELO-CORS-ALLOW': true,
        },
        body: JSON.stringify({
          tax_vouchno: taxvouNo,
          update: {
            tax_printdoc_url: pdfUploadRes.data.doc_cdnurl,
          },
        }),
      });
    }
    return null;
  }

  handleTaxDetailQuery = async (taxHeadSeqNo) => {
    const { userConf } = this.props;
    const queryParam = {
      limit: 50,
      offset: 0,
      taxHeadSeqNo,
    };
    const queryUrl = new URL(
      `${userConf.swapp_endpoint}/splserver/spl/epiTax/queryTaxDetailByExpAndPage`,
    );
    Object.keys(queryParam).forEach(key => queryUrl.searchParams.append(key, queryParam[key]));
    const res = await fetch(queryUrl, {
      headers: {
        rdtime: userConf.swapp.userinfo.rdtime,
      },
    });
    const commParsedRes = this.props.onParseSwappResult(res);
    if (commParsedRes) {
      return commParsedRes;
    }
    const resData = await res.json();
    const resDataJson = JSON.parse(resData);
    if (resDataJson.errCode && resDataJson.errCode !== '100') {
      return { error: resDataJson.errMsg };
    }
    return { error: null, data: resDataJson.unSafeBusinessData.rows };
  }

  handleWeloTaxPayScrape = async () => {
    const { userConf, onWeloWillLogin } = this.props;
    const { scrapeCached } = this.state;
    if (!userConf.weloapp.accesstoken) {
      onWeloWillLogin(true);
    } else {
      const taxPayDataSource = { ...this.state.taxPayDataSource };
      this.setState({ scraping: true });
      const pages = Math.ceil(taxPayDataSource.total / taxPayDataSource.pageSize);
      let newcookie;
      for (let i = 0; i < pages; i++) {
        let listQRes;
        if (pages === 1) {
          listQRes = { data: { rows: taxPayDataSource.list } };
        } else if (scrapeCached) {
          listQRes = {
            data: {
              rows: this.scrapedTaxPayCache.slice(
                i * taxPayDataSource.pageSize,
                (i + 1) * taxPayDataSource.pageSize,
              ),
            },
          };
        } else {
          let listRes = await this.handleTaxPayQuery(taxPayDataSource.pageSize, i);
          if (listRes.error === 'swapp-cookie-expire') {
            newcookie = listRes.cookie;
            listRes = await this.handleTaxPayQuery(taxPayDataSource.pageSize, i, newcookie);
          }
          if (!listRes.error) {
            listQRes = {
              data: {
                rows: listRes.data.unSafeBusinessData.rows,
              },
            };
          } else {
            listQRes = { error: listRes.error };
          }
        }
        if (!listQRes.error) {
          taxPayDataSource.current = i + 1;
          const drlist = listQRes.data.rows;
          taxPayDataSource.list = drlist;
          this.setState({ taxPayDataSource });
          for (let j = 0; j < drlist.length; j++) {
            const dr = drlist[j];
            dr.scrapeFg = 1;
            const taxds = await this.handleTaxDetailQuery(dr.taxHeadSeqNo);
            const postWelo = await this.postTaxPaymentForWelo(
              dr,
              taxds.data || [],
              userConf.weloapp.accesstoken,
              userConf.welo_endpoint,
            );
            if (!postWelo.error) {
              dr.scrapeFg = 2;
              if (!scrapeCached) {
                this.scrapedTaxPayCache.push(dr);
              }
            } else {
              dr.scrapeFg = 0;
              message.error(postWelo.error, 10);
            }
            taxPayDataSource.list[j] = dr;
            this.setState({ taxPayDataSource });
          }
        } else {
          message.error(listQRes.error, 10);
        }
      }
      this.setState({ scraping: false, scrapeCached: true });
    }
  };

  render() {
    const {
      searchDateRange,
      payStatus,
      searchEntryId,
      taxPayDataSource,
      listLoading,
      scraping,
      scrapeCached,
    } = this.state;
    const weloScrapeBtn = { disabled: true };
    const swSearchBtn = { disabled: false, type: 'primary' };
    if (taxPayDataSource.list.length > 0) {
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
            <Col span={8}>
              <FormItem label="支付状态">
                <RadioGroup
                  buttonStyle="solid"
                  value={payStatus}
                  onChange={this.handleIeFlagChange}
                >
                  <RadioButton value="1" key="1">
                    未支付
                  </RadioButton>
                  <RadioButton value="2" key="2">
                    支付失败
                  </RadioButton>
                  <RadioButton value="3" key="3">
                    支付成功
                  </RadioButton>
                </RadioGroup>
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
            <Col span={6}>
              <FormItem label="报关单号">
                <Input
                  value={searchEntryId}
                  data-field="searchEntryId"
                  onChange={this.handleEvValueChange}
                />
              </FormItem>
            </Col>
            <Col span={4} style={{ paddingTop: 28 }}>
              <Button
                icon="search"
                onClick={this.handleSwTaxPaySearch}
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
          dataSource={taxPayDataSource.list}
          onChange={this.handleTableChange}
          loading={listLoading}
          rowKey="taxvouNo"
          pagination={{
            total: taxPayDataSource.total,
            current: taxPayDataSource.current,
            pageSize: taxPayDataSource.pageSize,
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
            onClick={this.handleWeloTaxPayScrape}
          >
            同步到微骆云
          </Button>
        </div>
      </div>
    );
  }
}
