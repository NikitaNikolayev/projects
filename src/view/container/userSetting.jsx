/* eslint-disable react/jsx-one-expression-per-line */
import React from 'react';
import { Avatar, Icon, Drawer, Tabs, Button, Form, Input, Tooltip } from 'antd';

const FormItem = Form.Item;
const { TabPane } = Tabs;

export default class UserSetting extends React.Component {
  state = {
    userPanelVisible: false,
  };

  handleToggUserPanel = () => {
    const { userPanelVisible } = this.state;
    this.setState({ userPanelVisible: !userPanelVisible });
  };

  handleWeloLogin = () => {
    this.props.onWeloWillLogin();
  };

  handleWeloOut = () => {
    const weloapp = { account: { name: '', username: '' }, accesstoken: '' };
    this.props.onSessionSave(null, { weloapp });
  };

  handleSwOut = () => {
    const swapp = { cookie: '', cardpw: '' };
    this.props.onSessionSave({ swapp });
  };

  render() {
    const { userPanelVisible } = this.state;
    const {
      userConf: { swapp, weloapp },
    } = this.props;
    const weloUserName = this.state.weloUserName || weloapp.account.username;
    return [
      <div className="user-avatar" onClick={this.handleToggUserPanel} key="avatar">
        {!weloUserName ? (
          <Tooltip title="登录帐号" placement="right"><Avatar icon="user" /></Tooltip>
        ) : (
          <Tooltip title="帐号设置" placement="right">
            <Avatar style={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>
              {weloapp.account.name.slice(0, 1)}
            </Avatar>
          </Tooltip>
        )}
      </div>,
      <Drawer
        title="帐号设置"
        width={360}
        visible={userPanelVisible}
        onClose={this.handleToggUserPanel}
        placement="left"
        getContainer={() => document.getElementById('main-content')}
        key="drawer"
      >
        <Tabs>
          <TabPane
            tab={<span><Icon type="cloud" /> 微骆云帐号</span>}
            key="weloapp"
          >
            {!weloUserName ? (
              <Button block icon="login" type="primary" onClick={this.handleWeloLogin}>
                登录
              </Button>
            ) : (
              <Button
                type="danger"
                block
                onClick={this.handleWeloOut}
              >
                退出当前{weloapp.account.name}的登录
              </Button>
            )}
          </TabPane>
          <TabPane
            tab={<span><Icon type="desktop" /> 单一窗口帐号</span>}
            key="singlewin"
          >
            <Form layout="vertical">
              <FormItem label="IC卡编号">
                <Input prefix={<Icon type="credit-card" />} value={swapp.userinfo && swapp.userinfo.cards} readOnly />
              </FormItem>
              <FormItem label="卡介质密码">
                <Input.Password prefix={<Icon type="lock" />} value={swapp.cardpw} readOnly />
              </FormItem>
              <Button type="danger" block onClick={this.handleSwOut}>
                退出单一窗口登录
              </Button>
            </Form>
          </TabPane>
        </Tabs>
      </Drawer>,
    ];
  }
}
