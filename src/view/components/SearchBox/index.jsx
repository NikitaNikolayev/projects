import React from 'react';
import PropTypes from 'prop-types';
import { Input } from 'antd';
import './style.less';

const { Search } = Input;

export default class SearchBox extends React.Component {
  static propTypes = {
    placeholder: PropTypes.string,
    onSearch: PropTypes.func.isRequired,
    borderless: PropTypes.bool,
    size: PropTypes.string,
  }
  static defaultProps = {
    size: 'default',
  }
  state = {
    lastSearch: '',
    value: null,
  }
  componentDidMount() {
    const propsHasValue = Object.keys(this.props).filter(key => key === 'value').length > 0;
    if (propsHasValue) {
      this.setState({ value: this.props.value });
    }
  }
  componentWillReceiveProps(nextProps) {
    const propsHasValue = Object.keys(nextProps).filter(key => key === 'value').length > 0;
    if (propsHasValue && (nextProps.value !== undefined || nextProps.value !== null)
    && this.props.value !== nextProps.value) { // 保证空字符串能够传入
      this.setState({ value: nextProps.value });
    }
  }
  handleFocus = (ev) => {
    ev.target.select();
  }
  handleChange = (ev) => {
    const { onSearch } = this.props;
    if (ev.target.value === '' && onSearch && this.state.lastSearch) {
      this.handleSearch('');
    }
    this.setState({ value: ev.target.value });
  }
  handleSearch = (searchValue) => {
    this.props.onSearch(searchValue);
    this.setState({ lastSearch: searchValue });
  }
  render() {
    const {
      placeholder, borderless, size, style,
    } = this.props;
    const { value } = this.state;
    return (
      <Search
        placeholder={placeholder}
        onChange={this.handleChange}
        onSearch={this.handleSearch}
        onFocus={this.handleFocus}
        enterButton
        value={value}
        size={size}
        style={style}
        className={`search-box ${borderless && 'search-box-borderless'}`}
      />
    );
  }
}
