/* eslint-disable react/jsx-one-expression-per-line */
import React from 'react';
import { LocaleProvider, Layout, Card, Modal, Tabs, Menu, Icon, message } from 'antd';
import zhCN from 'antd/lib/locale-provider/zh_CN';
import 'antd/dist/antd.css';
import UserSetting from './userSetting';
import CusDeclPane from './cusDecPane';
import DecModPane from './decModPane';
import TaxPayPane from './taxPayPane';
import InvtRegPane from './invtRegPane';
import StockIoPane from './stockIoPane';
import WeloStockIoPane from './weloStockIoPane';
import PassportPane from './passportPane';
import BizapplPane from './bizapplPane';
import ControlPane from './controlPane';
import SwClientConfig from './swClientConfig';
import ScheduledJobPane from './scheduledJobPane';
import LoginModal from '../components/loginModal';
import './style.less';
import {
  requireUserConf,
  saveUserConf,
  refreshSwappCookie,
  loadSwProxyYml,
  saveSwProxyConfig,
  beginSwProxyListen,
  beginSyncJobListen,
} from '../../rendererIpc/viewerIpc';

const { Content, Sider } = Layout;
const { TabPane } = Tabs;
const { confirm } = Modal;


export default class RootContainer extends React.Component {
  state = {
    weloLoginModalVis: false,
    weloLoginModalCntr: {
      triggerByApi: false,
    },
    userConf: { swapp: {}, weloapp: { account: {} } },
    currentMenu: 'clearance',
    aboutVisible: false,
    swProxy: { logList: [], proxyStatus: false },
  };

  componentDidMount() {
    const userConf = requireUserConf();
    this.setState({ userConf });
    this.handleSwUserinfo();
    this.handleSwProxyYml();
    beginSwProxyListen(this.swproxyclientCallback);
    beginSyncJobListen(this.syncJobSwCookieCallback, this.syncJobNonAccessCallback);
  }

  handleWeloSysLogin = (triggerByApi, tempOpenApi) => {
    this.setState({
      weloLoginModalVis: true,
      tempOpenApi,
      weloLoginModalCntr: { triggerByApi },
    });
  };

  handleAbout = (visible) => {
    message.warning('请登陆微骆账号');
    this.setState({ aboutVisible: visible });
  }

  swproxyclientCallback = (logInfo, status) => {
    const { swProxy } = this.state;
    if (logInfo) {
      const newList = swProxy.logList;
      newList.push(logInfo);
      if (newList.length > 20) {
        newList.shift();
      }
    }
    swProxy.proxyStatus = status;
    this.setState({ swProxy });
  };

  syncJobSwCookieCallback = (okAction, cancelAction) => {
    let second = 10;
    let canceled = false;
    const confirmModal = confirm({
      title: '单窗身份验证过期',
      content: `${second}s后即将自动登陆`,
      cancelText: '稍后执行',
      autoFocusButton: 'ok',
      onOk: () => {
        okAction();
      },
      onCancel: () => {
        canceled = true;
        cancelAction();
      },
    });
    const timer = setInterval(() => {
      second -= 1;
      confirmModal.update({
        content: `${second}s后即将自动登陆`,
      });
      if (second === 0) {
        clearInterval(timer);
        confirmModal.destroy();
        if (!canceled) {
          okAction();
        }
      }
    }, 1000);
  };

  syncJobNonAccessCallback = () => {
    this.handleWeloSysLogin();
  };

  handleSwProxyYml = () => {
    const configData = loadSwProxyYml();
    this.setState({ swProxyConfig: configData });
  }

  handleSaveSwProxyConfig = (newConfig) => {
    this.handleSessionSave(null, null, newConfig.clientapp.openapi_url);
    const newSwClientConf = { ...this.state.swProxyConfig, ...newConfig };
    saveSwProxyConfig(newSwClientConf);
    this.setState({ swProxyConfig: newSwClientConf });
  }

  handleSwUserinfo = async () => {
    const queryUrl = 'https://swapp.singlewindow.cn/splserver/sw/spl/para/getUserinfo';
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: this.state.userConf.swapp.cookie,
      },
    });
    if (res.ok && !res.redirected && res.status === 200) {
      const resJson = await res.json();
      if (resJson.errCode === '100') {
        const userinfo = resJson.unSafeBusinessData.data;
        this.handleSessionSave({ userinfo });
      }
    }
  };

  handleSessionSave = (swappconf, weloappconf, wlApiUrl, syncjobConfig) => {
    const newUserConf = { ...this.state.userConf };
    if (swappconf) {
      if (swappconf.swapp) {
        newUserConf.swapp = swappconf.swapp;
      } else {
        Object.assign(newUserConf.swapp, swappconf);
      }
    }
    if (weloappconf) {
      if (weloappconf.weloapp) {
        newUserConf.weloapp = weloappconf.weloapp;
      } else {
        Object.assign(newUserConf.weloapp, weloappconf);
      }
    }
    if (wlApiUrl) {
      newUserConf.welo_endpoint = wlApiUrl;
    }
    if (syncjobConfig) {
      Object.assign(newUserConf.syncjob_config, syncjobConfig.config);
    }
    this.setState({ userConf: newUserConf });
    saveUserConf(swappconf, weloappconf, wlApiUrl, syncjobConfig);
  };

  handleSwAppRequestParse = (swappres) => {
    if (swappres.refresh) {
      refreshSwappCookie();
      return null;
    }
    if (!swappres.ok || swappres.status !== 200) {
      return { error: swappres.statusText };
    }
    if (swappres.redirected) {
      if (swappres.url === 'https://swapp.singlewindow.cn/decserver/error/showError.jsp') {
        return { error: 'swapp-query-exception' };
      }
      if (swappres.url.indexOf('https://app.singlewindow.cn/cas/login') !== -1) {
        const newswcookie = refreshSwappCookie();
        const swapp = { ...this.state.userConf.swapp };
        swapp.cookie = newswcookie;
        this.setState({ userConf: { ...this.state.userConf, swapp } });
        return { error: 'swapp-cookie-expire', cookie: newswcookie };
      }
      return { error: 'redirect-error' };
    }
    return null;
  };

  handleCloseLoginModal = (success, loginData) => {
    if (success) {
      this.setState((prevState) => {
        const weloapp = { ...prevState.userConf.weloapp };
        const weloaccount = { ...weloapp.account };
        Object.keys(loginData).forEach((lgrKey) => {
          if (lgrKey === 'access_token') {
            weloapp.accesstoken = loginData[lgrKey];
          } else {
            weloaccount[lgrKey] = loginData[lgrKey];
          }
        });
        weloapp.account = weloaccount;
        saveUserConf(null, weloapp);
        const userConf = { ...prevState.userConf };
        userConf.weloapp = weloapp;
        return { userConf, weloLoginModalVis: false, tempOpenApi: null };
      });
    } else {
      this.setState({ weloLoginModalVis: false, tempOpenApi: null });
    }
  };

  handleMenuClick = (ev) => {
    this.setState({ currentMenu: ev.key });
  };

  render() {
    const {
      currentMenu, userConf, weloLoginModalVis, weloLoginModalCntr, tempOpenApi, swProxy,
    } = this.state;
    return (
      <LocaleProvider locale={zhCN}>
        <Layout style={{ height: '100%' }}>
          <Sider collapsed style={{ zIndex: 1001 }}>
            <div className="brand" onClick={() => this.handleAbout(true)}>
              <img src="https://static-cdn.welogix.cn/images/welogix_logo_360.png" alt="logo" />
            </div>
            <UserSetting
              userConf={userConf}
              onWeloWillLogin={this.handleWeloSysLogin}
              onSessionSave={this.handleSessionSave}
            />
            <Menu
              theme="dark"
              selectedKeys={[currentMenu]}
              mode="inline"
              onClick={this.handleMenuClick}
            >
              <Menu.Item key="clearance">
                <Icon type="global" />
                <span>进出口申报</span>
              </Menu.Item>
              <Menu.SubMenu
                key="bws"
                title={<span><Icon type="block" /></span>}
              >
                <Menu.Item key="stockio">出入库单</Menu.Item>
                <Menu.Item key="invtreg">核注清单</Menu.Item>
                <Menu.Item key="passport">核放单</Menu.Item>
                <Menu.Item key="bizappl">业务申报表</Menu.Item>
              </Menu.SubMenu>
              <Menu.Item key="proxy">
                <Icon type="control" />
                <span>设置</span>
              </Menu.Item>
            </Menu>
          </Sider>
          <Layout id="main-content">
            <Content className="layout-content">
              {currentMenu === 'clearance' && (
                <Card bodyStyle={{ padding: 8 }} bordered={false}>
                  <Tabs>
                    <TabPane
                      tab={<span><Icon type="desktop" />报关单</span>}
                      key="cusdecl"
                    >
                      <CusDeclPane
                        userConf={userConf}
                        onWeloWillLogin={this.handleWeloSysLogin}
                        onSessionSave={this.handleSessionSave}
                        onParseSwappResult={this.handleSwAppRequestParse}
                      />
                    </TabPane>
                    <TabPane
                      tab={<span><Icon type="desktop" />修撤单</span>}
                      key="decmod"
                    >
                      <DecModPane
                        userConf={userConf}
                        onWeloWillLogin={this.handleWeloSysLogin}
                        onSessionSave={this.handleSessionSave}
                        onParseSwappResult={this.handleSwAppRequestParse}
                      />
                    </TabPane>
                    <TabPane
                      tab={<span><Icon type="desktop" />税费单</span>}
                      key="taxpay"
                    >
                      <TaxPayPane
                        userConf={userConf}
                        onWeloWillLogin={this.handleWeloSysLogin}
                        onSessionSave={this.handleSessionSave}
                        onParseSwappResult={this.handleSwAppRequestParse}
                      />
                    </TabPane>
                  </Tabs>
                </Card>
              )}
              {currentMenu === 'invtreg' && (
                <Card bodyStyle={{ padding: 8 }} bordered={false}>
                  <Tabs>
                    <TabPane
                      tab={<span><Icon type="desktop" />单窗核注清单</span>}
                      key="invtreg"
                    >
                      <InvtRegPane
                        userConf={userConf}
                        onWeloWillLogin={this.handleWeloSysLogin}
                        onSessionSave={this.handleSessionSave}
                        onParseSwappResult={this.handleSwAppRequestParse}
                      />
                    </TabPane>
                  </Tabs>
                </Card>
              )}
              {currentMenu === 'passport' && (
                <Card bodyStyle={{ padding: 8 }} bordered={false}>
                  <Tabs>
                    <TabPane
                      tab={<span> <Icon type="desktop" />单窗核放单</span>}
                      key="passport"
                    >
                      <PassportPane
                        userConf={userConf}
                        onWeloWillLogin={this.handleWeloSysLogin}
                        onSessionSave={this.handleSessionSave}
                        onParseSwappResult={this.handleSwAppRequestParse}
                      />
                    </TabPane>
                  </Tabs>
                </Card>
              )}
              {currentMenu === 'bizappl' && (
                <Card bodyStyle={{ padding: 8 }} bordered={false}>
                  <Tabs>
                    <TabPane
                      tab={<span> <Icon type="desktop" />单窗业务申报表</span>}
                      key="bizappl"
                    >
                      <BizapplPane
                        userConf={userConf}
                        onWeloWillLogin={this.handleWeloSysLogin}
                        onSessionSave={this.handleSessionSave}
                        onParseSwappResult={this.handleSwAppRequestParse}
                      />
                    </TabPane>
                  </Tabs>
                </Card>
              )}
              {currentMenu === 'stockio' && (
                <Card bodyStyle={{ padding: 8 }} bordered={false}>
                  <Tabs>
                    <TabPane
                      tab={<span><Icon type="cloud" />微骆出入库单</span>}
                      key="wlStockio"
                    >
                      <WeloStockIoPane
                        userConf={userConf}
                        onWeloWillLogin={this.handleWeloSysLogin}
                        onSessionSave={this.handleSessionSave}
                        onParseSwappResult={this.handleSwAppRequestParse}
                      />
                    </TabPane>
                    <TabPane
                      tab={<span><Icon type="desktop" />单窗出入库单</span>}
                      key="desktop"
                    >
                      <StockIoPane
                        userConf={userConf}
                        onWeloWillLogin={this.handleWeloSysLogin}
                        onSessionSave={this.handleSessionSave}
                        onParseSwappResult={this.handleSwAppRequestParse}
                      />
                    </TabPane>
                  </Tabs>
                </Card>
              )}
              {currentMenu === 'proxy' && (
                <Card bodyStyle={{ padding: 8 }} bordered={false}>
                  <Tabs>
                    <TabPane tab={<span><Icon type="container" />报文收发</span>} key="control">
                      <ControlPane
                        swProxyConfig={this.state.swProxyConfig}
                        userConf={userConf}
                        onWeloWillLogin={this.handleWeloSysLogin}
                        onParseSwappResult={this.handleSwAppRequestParse}
                        swProxy={swProxy}
                      />
                    </TabPane>
                    <TabPane tab={<span><Icon type="sync" />同步配置</span>} key="config">
                      <SwClientConfig
                        swProxyConfig={this.state.swProxyConfig}
                        onSwClientSave={this.handleSaveSwProxyConfig}
                        userConf={userConf}
                        onWeloWillLogin={this.handleWeloSysLogin}
                        onSessionSave={this.handleSessionSave}
                      />
                    </TabPane>
                    <TabPane tab={<span><Icon type="robot" />定时任务</span>} key="robot">
                      <ScheduledJobPane
                        userConf={userConf}
                        onSessionSave={this.handleSessionSave}
                      />
                    </TabPane>
                  </Tabs>
                </Card>
              )}
            </Content>
            <LoginModal
              userConf={userConf}
              tempOpenApi={tempOpenApi}
              visible={weloLoginModalVis}
              control={weloLoginModalCntr}
              onLoginClose={this.handleCloseLoginModal}
            />
            <Modal
              width={320}
              visible={this.state.aboutVisible}
              onCancel={() => this.handleAbout(false)}
              footer={null}
            >
              <b>微骆单窗通客户端</b>
              <p>版本: 1.2.0</p>
              <p>Made with ❤ by <a target="_blank" rel="noopener noreferrer" href="https://www.welogix.tech"><span>WeLogix Team</span></a></p>
            </Modal>
          </Layout>
        </Layout>
      </LocaleProvider>
    );
  }
}
