/* eslint-disable react/jsx-wrap-multilines */
/* eslint-disable react/prefer-stateless-function */
import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { DatePicker } from 'antd';

const { RangePicker } = DatePicker;

export default class DateRangeSelect extends React.Component {
  static propTypes = {

    // eslint-disable-next-line react/forbid-prop-types
    value: PropTypes.array,
    onChange: PropTypes.func,
  }

  render() {
    const {
      value, onChange, renderExtraFooter,
    } = this.props;
    let rangeValue = [];
    if (value.length > 0 && value[0] !== '') {
      rangeValue = [moment(value[0]), moment(value[1])];
    }
    return (<RangePicker
      onChange={onChange}
      value={rangeValue}
      format="YYYY-MM-DD"
      ranges={{
        今天: [moment(), moment()],
        过去30天: [moment().subtract(30, 'days'), moment()],
        过去90天: [moment().subtract(90, 'days'), moment()],
        本周: [moment().startOf('week'), moment().endOf('week')],
        上周: [moment().subtract(1, 'weeks').startOf('week'), moment().subtract(1, 'weeks').endOf('week')],
        本月: [moment().startOf('month'), moment().endOf('month')],
        上月: [moment().subtract(1, 'months').startOf('month'), moment().subtract(1, 'months').endOf('month')],
        今年: [moment().startOf('year'), moment().endOf('year')],
      }}
      renderExtraFooter={renderExtraFooter}
    />);
  }
}
