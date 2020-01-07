import React from 'react';
import { Modal, Form, Input, Alert, Button, Icon } from 'antd';

const FormItem = Form.Item;

export default class LoginModal extends React.Component {
  state = {
    errorMsg: '',
    username: undefined,
    password: undefined,
  };

  handleTextChange = (ev) => {
    const targetNode = ev.target;
    this.setState({ [targetNode.dataset.field]: targetNode.value });
  };

  handleFinishLogin = (success, loginData) => {
    this.setState({
      errorMsg: '',
      username: undefined,
      password: undefined,
    });
    this.props.onLoginClose(success, loginData);
  };

  handleOk = () => {
    this.handleFinishLogin(false);
  };

  handleSubmit = async () => {
    const { userConf, tempOpenApi } = this.props;
    const { username, password } = this.state;
    const apiEp = tempOpenApi || userConf.welo_endpoint;
    const loginRes = await fetch(`${apiEp}/connect/oauth2/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WELO-CORS-ALLOW': true,
      },
      body: JSON.stringify({
        username,
        password,
        appType: 'SW_WEBEXT',
        grant_type: 'client_credential',
        withUser: true,
        persist: true,
      }),
    });
    if (loginRes.ok && loginRes.status === 200) {
      const resJson = await loginRes.json();
      if (resJson.status > 0 && resJson.status !== 200) {
        this.setState({ errorMsg: resJson.err_msg || resJson.msg || '登录失败' });
      } else {
        this.handleFinishLogin(true, resJson);
      }
    } else {
      this.setState({ errorMsg: loginRes.statusText });
    }
  };

  render() {
    const { errorMsg, username, password } = this.state;
    const { visible, control } = this.props;
    let submitDisabled = false;
    if (!username || !password) {
      submitDisabled = true;
    }
    return (
      <Modal
        visible={visible}
        onCancel={this.handleOk}
        footer={null}
        title="登录微骆云"
        width={420}
      >
        {errorMsg && (
          <Alert type="warning" showIcon message={errorMsg} style={{ marginBottom: 16 }} />
        )}
        {control.triggerByApi && (
          <Alert
            type="info"
            message="登录成功后重新点击发送/保存"
            closable
            style={{ marginBottom: 16 }}
          />
        )}
        <Form>
          <FormItem>
            <Input
              prefix={<Icon type="user" />}
              placeholder="用户手机/邮箱"
              data-field="username"
              value={username}
              onChange={this.handleTextChange}
            />
          </FormItem>
          <FormItem>
            <Input.Password
              prefix={<Icon type="lock" />}
              data-field="password"
              placeholder="密码"
              onChange={this.handleTextChange}
              value={password}
            />
          </FormItem>
          <FormItem>
            <Button disabled={submitDisabled} onClick={this.handleSubmit} type="primary">
              登录
            </Button>
          </FormItem>
        </Form>
      </Modal>
    );
  }
}
