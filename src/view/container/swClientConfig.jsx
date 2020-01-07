import React from 'react';
import { Button, Divider, Form, Input, Col, Row, Tabs, message, Card, Select } from 'antd';

const { TabPane } = Tabs;
const { Option } = Select;
const formParams = {
  dec: {
    in: { text: '回执文件', field: 'inbox' },
    out: { text: '待发送文件', field: 'outbox' },
    sent: { text: '已发送文件', field: 'sentbox' },
    fail: { text: '失败文件', field: 'failbox' },
  },
  decEdoc: {
    in: { text: '随附单证回执文件', field: 'edoc_inbox' },
    out: { text: '随附单证待发送文件', field: 'edoc_outbox' },
    sent: { text: '随附单证已发送文件', field: 'edoc_sentbox' },
    fail: { text: '随附单证失败文件', field: 'edoc_failbox' },
  },
  sas: {
    in: { text: '回执文件', field: 'sas_inbox' },
    out: { text: '待发送文件', field: 'sas_outbox' },
    sent: { text: '已发送文件', field: 'sas_sentbox' },
    fail: { text: '失败文件', field: 'sas_failbox' },
  },
  nems: {
    in: { text: '回执文件', field: 'nems_inbox' },
    out: { text: '待发送文件', field: 'nems_outbox' },
    sent: { text: '已发送文件', field: 'nems_sentbox' },
    fail: { text: '失败文件', field: 'nems_failbox' },
  },
  npts: {
    in: { text: '回执文件', field: 'npts_inbox' },
    out: { text: '待发送文件', field: 'npts_outbox' },
    sent: { text: '已发送文件', field: 'npts_sentbox' },
    fail: { text: '失败文件', field: 'npts_failbox' },
  },
  nbhl: {
    in: { text: '回执文件', field: 'nbhl_inbox' },
    out: { text: '待发送文件', field: 'nbhl_outbox' },
    sent: { text: '已发送文件', field: 'nbhl_sentbox' },
    fail: { text: '失败文件', field: 'nbhl_failbox' },
  },
};

export default class SwClientConfig extends React.Component {
  state = {
    activeTabKey: 'decl',
    openApiPrefix: 'https',
    openApiHost: '',
    swclientQueue: '',
    swQueueHost: '',
    swclientinfo: {
      appId: '',
      appKey: '',
      token: '',
    },
    watchdirs: {},
  };

  componentDidMount() {
    const { clientapp, watchtube, host, watchdirs } = this.props.swProxyConfig;
    let openApiPrefix;
    let openApiHost = clientapp.openapi_url;
    let opaSchemaIdx = 0;
    if (clientapp.openapi_url.indexOf('https://') === 0) {
      opaSchemaIdx = 8;
    } else if (clientapp.openapi_url.indexOf('http://') === 0) {
      opaSchemaIdx = 7;
    }
    if (opaSchemaIdx > 0) {
      openApiPrefix = clientapp.openapi_url.slice(0, opaSchemaIdx);
      openApiHost = clientapp.openapi_url.slice(opaSchemaIdx);
    }
    const queue = watchtube.filter(tube => tube !== 'swclient-queue')[0];
    this.setState({ swQueueHost: host,
      openApiPrefix,
      openApiHost,
      swclientQueue: queue,
      swclientinfo: {
        appId: clientapp.appId,
        appKey: clientapp.appKey,
        token: clientapp.token,
      },
      watchdirs });
  }

  handleSave = async () => {
    const { openApiPrefix, openApiHost, swQueueHost,
      swclientinfo, watchdirs } = this.state;
    let { swclientQueue } = this.state;
    const { userConf, onWeloWillLogin } = this.props;
    if (!swclientinfo.appId || !swclientinfo.appKey) {
      message.warning('客户端ID与密钥未填写');
      return;
    }
    const apiEp = `${openApiPrefix}${openApiHost}`;
    if (!userConf.weloapp.accesstoken) {
      message.info('完成登录后需要再点击保存');
      onWeloWillLogin(true, apiEp);
      return;
    }
    const newswclientinfo = { ...swclientinfo };
    if (!swclientinfo.token) {
      // 首次配置获取token
      const postRes = await fetch(`${apiEp}/oauth2/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WELO-CORS-ALLOW': true,
        },
        body: JSON.stringify({
          app_id: swclientinfo.appId,
          app_secret: swclientinfo.appKey,
          grant_type: 'client_credential',
          persist: true,
        }),
      });
      if (postRes.ok && postRes.status === 200) {
        const postResJson = await postRes.json();
        if (postResJson.status !== 200 && !postResJson.access_token) {
          message.error(postResJson.msg || '获取客户端代理密钥失败');
        } else {
          newswclientinfo.token = postResJson.access_token;
        }
      } else {
        message.error(postRes.statusText);
      }
    }
    const postRes = await fetch(`${apiEp}/v1/sw/proxyclientconfig`, {
      // 获取tube
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WELO-CORS-ALLOW': true,
      },
      body: JSON.stringify({
        token: userConf.weloapp.accesstoken,
        appId: swclientinfo.appId,
      }),
    });
    if (postRes.ok && postRes.status === 200) {
      try {
        const postResJson = await postRes.json();
        if (postResJson.data) {
          if (swclientQueue !== postResJson.data.queue) {
            swclientQueue = postResJson.data.queue;
          }
        }
      } catch (err) {
        message.error(err.message);
      }
    } else {
      message.error(postRes.msg);
    }
    this.setState({ swclientQueue, swclientinfo: newswclientinfo });
    newswclientinfo.openapi_url = apiEp;
    this.props.onSwClientSave({
      host: swQueueHost,
      watchtube: ['swclient-queue', swclientQueue],
      watchdirs,
      clientapp: newswclientinfo,
    });

    message.success('保存成功');
  };

  handleDirValueChange = (ev) => {
    const targetNode = ev.target;
    const watchdirs = { ...this.state.watchdirs };
    const { field } = targetNode.dataset;
    watchdirs[field] = targetNode.value;
    this.setState({ watchdirs });
  };

  handleSwQueueHostChange = (ev) => {
    this.setState({ swQueueHost: ev.target.value });
  };

  handleClientValueChange = (ev) => {
    const targetNode = ev.target;
    const swclientinfo = { ...this.state.swclientinfo };
    const { field } = targetNode.dataset;
    swclientinfo[field] = targetNode.value;
    this.setState({ swclientinfo });
  };

  handleGetConfigForm = (key, watchdirs) => (
    <Form layout="vertical">
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item label={formParams[key].in.text}>
            <Input
              value={watchdirs[formParams[key].in.field]}
              data-field={formParams[key].in.field}
              onChange={this.handleDirValueChange}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label={formParams[key].out.text}>
            <Input
              value={watchdirs[formParams[key].out.field]}
              data-field={formParams[key].out.field}
              onChange={this.handleDirValueChange}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label={formParams[key].sent.text}>
            <Input
              value={watchdirs[formParams[key].sent.field]}
              data-field={formParams[key].sent.field}
              onChange={this.handleDirValueChange}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label={formParams[key].fail.text}>
            <Input
              value={watchdirs[formParams[key].fail.field]}
              data-field={formParams[key].fail.field}
              onChange={this.handleDirValueChange}
            />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );

  handleTabChange = (tabKey) => {
    this.setState({ activeTabKey: tabKey });
  };

  handleApiHostChange = (field, value) => {
    this.setState({ [field]: value });
    if (field === 'openApiHost') {
      this.props.onSessionSave(null, { accesstoken: '' });
    }
  };

  render() {
    const { openApiPrefix, openApiHost, swclientQueue, swQueueHost,
      swclientinfo, watchdirs } = this.state;
    const selectBefore = (
      <Select
        defaultValue="https://"
        style={{ width: 90 }}
        onSelect={value => this.handleApiHostChange('openApiPrefix', value)}
        value={openApiPrefix}
      >
        <Option value="http://">http://</Option>
        <Option value="https://">https://</Option>
      </Select>
    );
    return (
      <div>
        <Card title="基本参数">
          <Form layout="vertical">
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item label="微骆云OpenAPI">
                  <Input
                    addonBefore={selectBefore}
                    value={openApiHost}
                    onChange={ev => this.handleApiHostChange('openApiHost', ev.target.value)}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="客户端ID">
                  <Input
                    value={swclientinfo.appId}
                    data-field="appId"
                    onChange={this.handleClientValueChange}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="客户端密钥">
                  <Input.Password
                    value={swclientinfo.appKey}
                    data-field="appKey"
                    onChange={this.handleClientValueChange}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="消息队列服务器">
                  <Input value={swQueueHost} onChange={this.handleSwQueueHostChange} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="消息队列ID">
                  <Input value={swclientQueue} disabled />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="代理客户端密钥">
                  <Input.Password
                    value={swclientinfo.token}
                    disabled
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>
        <Card title="监听路径设置" style={{ marginTop: 16, marginBottom: 54 }}>
          <Row gutter={16}>
            <Col span={24}>
              <Tabs activeKey={this.state.activeTabKey} onChange={this.handleTabChange}>
                <TabPane tab="货物申报" key="decl">
                  {this.handleGetConfigForm('dec', watchdirs)}
                  <Divider />
                  {this.handleGetConfigForm('decEdoc', watchdirs)}
                </TabPane>
                <TabPane tab="特殊区域/保税物流" key="sasbl">
                  {this.handleGetConfigForm('sas', watchdirs)}
                </TabPane>
                <TabPane tab="加工贸易账册" key="ptsEms">
                  {this.handleGetConfigForm('nems', watchdirs)}
                </TabPane>
                <TabPane tab="加工贸易手册" key="ptsEml">
                  {this.handleGetConfigForm('npts', watchdirs)}
                </TabPane>
                <TabPane tab="保税流转" key="ptsNbhl">
                  {this.handleGetConfigForm('nbhl', watchdirs)}
                </TabPane>
              </Tabs>
            </Col>
          </Row>
        </Card>
        <div className="bottom-bar">
          <Button type="primary" size="large" icon="save" onClick={this.handleSave}>
            保存
          </Button>
        </div>
      </div>
    );
  }
}
