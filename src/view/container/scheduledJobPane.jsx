import React from 'react';
import { Button, Checkbox, Form, Col, Row, Switch, Card, InputNumber, message } from 'antd';

const formItemLayout = {
  labelCol: { span: 8 },
  wrapperCol: { span: 14 },
};

const plainOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export default class ScheduledJobPane extends React.Component {
  state = {
    bizCheckedList: [],
    indeterminate: true,
    checkAll: false,
    jobStatus: false,
    jobInterval: 24,
  };

  componentDidMount() {
    const { userConf } = this.props;
    const config = userConf.syncjob_config;
    if (config) {
      this.setState({
        bizCheckedList: config.bizType,
        jobStatus: config.status,
        jobInterval: config.interval,
      });
    }
  }

  handleBizCheckedChange = (bizCheckedList) => {
    this.setState({
      bizCheckedList,
      indeterminate: !!bizCheckedList.length && bizCheckedList.length < plainOptions.length,
      checkAll: bizCheckedList.length === plainOptions.length,
    });
  };

  handleCheckedChange = (value) => {
    this.setState({ jobStatus: value });
  };

  handleIntervalChange = (value) => {
    if (value && value <= 24) {
      this.setState({ jobInterval: value });
    } else {
      message.warning('间隔时间取值为1-24小时，请重新输入', 5);
    }
  };

  handleCheckAllChange = (e) => {
    this.setState({
      bizCheckedList: e.target.checked ? plainOptions : [],
      indeterminate: false,
      checkAll: e.target.checked,
    });
  };

  handleSave = () => {
    if (this.state.jobStatus && this.state.bizCheckedList.length === 0) {
      message.warning('未设置业务类型', 5);
    }
    let immediateStart = false;
    if (this.state.jobStatus && !this.props.userConf.syncjob_config.status) {
      immediateStart = true;
    }
    const syncjobConfig = {
      config: {
        bizType: this.state.bizCheckedList,
        status: this.state.jobStatus,
        interval: this.state.jobInterval,
      },
      immediateStart,
    };
    this.props.onSessionSave(null, null, null, syncjobConfig);
    message.success('已保存', 5);
  };

  render() {
    return (
      <div>
        <Card>
          <Form layout="horizontal">
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item>
                  <Switch checked={this.state.jobStatus} checkedChildren="开启" unCheckedChildren="关闭" style={{ marginRight: 4 }} onChange={this.handleCheckedChange} />
                  定时同步单一窗口数据
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="同步间隔时间" {...formItemLayout}>
                  <InputNumber size="large" min={1} max={24} defaultValue={24} onChange={this.handleIntervalChange} value={this.state.jobInterval} />
                  小时
                </Form.Item>
              </Col>
            </Row>
            <div style={{ borderBottom: '1px solid #E9E9E9' }}>
              <Checkbox
                indeterminate={this.state.indeterminate}
                onChange={this.handleCheckAllChange}
                checked={this.state.checkAll}
              >
                同步业务类型
              </Checkbox>
            </div>
            <br />
            <Checkbox.Group
              value={this.state.bizCheckedList}
              onChange={this.handleBizCheckedChange}
              style={{ width: '100%' }}
            >
              <Row>
                <Col span={6}>
                  <Checkbox value="A">报关单</Checkbox>
                </Col>
                <Col span={6}>
                  <Checkbox value="B">修撤单</Checkbox>
                </Col>
                <Col span={6}>
                  <Checkbox value="C">税费单</Checkbox>
                </Col>
              </Row>
              <Row>
                <Col span={6}>
                  <Checkbox value="D">核注清单</Checkbox>
                </Col>
                <Col span={6}>
                  <Checkbox value="E">核放单</Checkbox>
                </Col>
                <Col span={6}>
                  <Checkbox value="F">业务申报表</Checkbox>
                </Col>
                <Col span={6}>
                  <Checkbox value="G">出入库单</Checkbox>
                </Col>
              </Row>
            </Checkbox.Group>
          </Form>
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
