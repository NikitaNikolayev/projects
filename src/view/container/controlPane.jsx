import React from 'react';
import { Button, Col, Row, Progress, message, Card, Timeline } from 'antd';
import moment from 'moment';
import { startSwFileProcedure, stopSwFileProcedure } from '../../rendererIpc/viewerIpc';

export default class ControlPane extends React.Component {
  state = {
    toggleLoading: false,
  };

  toggleRunning = async (status) => {
    this.setState({ toggleLoading: true });
    const { swProxyConfig: { clientapp: { appId, token }, watchtube } } = this.props;
    const queue = watchtube.filter(tube => tube !== 'swclient-queue')[0];
    if (status) {
      const { userConf, onWeloWillLogin } = this.props;
      if (userConf.swapp.userinfo && userConf.swapp.userinfo.cards) {
        if (!userConf.weloapp.accesstoken) {
          onWeloWillLogin(true);
        } else {
          if (!appId || !token || !queue) {
            message.warning('配置信息不存在, 请先配置参数', 10);
            this.setState({ toggleLoading: false });
            return;
          }
          const apiEp = userConf.welo_endpoint;
          const postRes = await fetch(`${apiEp}/v1/sw/proxyclientconfig`, {
          // 校验单一窗口操作卡号与微骆配置的操作人卡号是否一致
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-WELO-CORS-ALLOW': true,
            },
            body: JSON.stringify({
              token: userConf.weloapp.accesstoken,
              cardNo: userConf.swapp.userinfo.cards,
              appId,
            }),
          });
          if (postRes.ok && postRes.status === 200) {
            try {
              const postResJson = await postRes.json();
              if (postResJson.data) {
                if (postResJson.data.cardCheckFlag) {
                  startSwFileProcedure();
                  this.setState({ toggleLoading: false });
                } else {
                  message.error('当前单一窗口操作卡号与微骆单一窗口配置操作人卡号不相同。', 10);
                }
              } else {
                message.error(postResJson.msg, 10);
              }
            } catch (err) {
              message.error(err.message);
            }
          } else {
            message.error(postRes.statusText);
          }
        }
      } else {
        message.error('单一窗口未登录', 10);
        this.props.onParseSwappResult({ refresh: true });
      }
    } else {
      stopSwFileProcedure();
    }
    this.setState({ toggleLoading: false });
  };

  render() {
    const { toggleLoading } = this.state;
    const { swProxy } = this.props;
    const { proxyStatus, logList } = swProxy;
    let strockColor = {
      from: '#778899',
      to: '#B0C4DE',
    };
    if (proxyStatus) {
      strockColor = {
        from: '#108ee9',
        to: '#87d068',
      };
    }
    const badgeList = {
      10: { color: '#ccc', text: 'TRACE' },
      20: { color: '#13c2c2', text: 'DEBUG' },
      30: { color: '#1890ff', text: 'INFO' },
      40: { color: '#fa8c16', text: 'WARNING' },
      50: { color: '#fa541c', text: 'ERROR' },
      60: { color: '#cf1322', text: 'FATAL' },
    };
    return (
      <div>
        <Card>
          <Row gutter={24}>
            <Col lg={2} md={24}>
              {proxyStatus ? (
                <Button
                  type="danger"
                  size="large"
                  icon="stop"
                  disabled={toggleLoading}
                  onClick={() => this.toggleRunning(false)}
                >
                  停止
                </Button>
              ) : (
                <Button
                  type="primary"
                  size="large"
                  icon="caret-right"
                  disabled={toggleLoading}
                  onClick={() => this.toggleRunning(true)}
                >
                  启动
                </Button>
              )}
            </Col>
            <Col lg={{ span: 20, offset: 2 }} md={24}>
              <Progress
                strokeColor={strockColor}
                strokeWidth={24}
                percent={99.9}
                status={proxyStatus ? 'active' : 'normal'}
                showInfo={false}
                style={{ marginTop: 8 }}
              />
            </Col>
          </Row>
        </Card>
        <Card size="small" title="运行日志" bodyStyle={{ padding: 16, minHeight: 160, maxHeight: 540, overflowY: 'auto' }} className="output" style={{ marginTop: 16 }}>
          <Timeline reverse>
            {
              logList.map(item => (
                <Timeline.Item color={badgeList[item.log_level].color}>
                  <div>{item.log_content}</div>
                  {moment(item.created_date).format('YYYY-MM-DD HH:mm:ss')}
                </Timeline.Item>
              ))
            }
          </Timeline>
        </Card>
      </div>
    );
  }
}
