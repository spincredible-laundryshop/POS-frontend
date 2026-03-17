import { useMemo, useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function OverviewSummary({ 
  openSales, 
  closedSales, 
  formatCurrency 
}) {
  const [timePeriod, setTimePeriod] = useState('daily'); // 'yearly', 'monthly', 'weekly', 'daily'
  const [visibleItems, setVisibleItems] = useState(new Set()); // Track which items are visible in chart

  // Safe format currency function
  const safeFormatCurrency = (value) => {
    const numValue = Number(value) || 0;
    return formatCurrency(numValue);
  };

  // Time period options
  const timePeriodOptions = [
    { id: 'daily', label: 'Daily', icon: '📅' },
    { id: 'weekly', label: 'Weekly', icon: '📊' },
    { id: 'monthly', label: 'Monthly', icon: '📈' },
    { id: 'yearly', label: 'Yearly', icon: '📋' }
  ];

  // Format period labels for display
  const formatPeriodLabel = (period, timePeriod) => {
    switch (timePeriod) {
      case 'yearly':
        return period;
      case 'monthly':
        const [year, month] = period.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      case 'weekly':
        return new Date(period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'daily':
      default:
        return new Date(period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Group sales data by time period
  const groupSalesByPeriod = (sales, period) => {
    const grouped = {};
    
    sales.forEach(sale => {
      const date = new Date(sale.created_at);
      let key;
      
      switch (period) {
        case 'yearly':
          key = date.getFullYear().toString();
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'weekly':
          const startOfWeek = new Date(date);
          startOfWeek.setDate(date.getDate() - date.getDay());
          key = startOfWeek.toISOString().split('T')[0];
          break;
        case 'daily':
        default:
          key = date.toISOString().split('T')[0];
          break;
      }
      
      if (!grouped[key]) {
        grouped[key] = { open: [], closed: [], total: 0, revenue: 0 };
      }
      
      const saleTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) || 0) * (item.qty || 1), 0);
      
      if (sale.paid_at) {
        grouped[key].closed.push(sale);
      } else {
        grouped[key].open.push(sale);
      }
      
      grouped[key].total += 1;
      grouped[key].revenue += saleTotal;
    });
    
    return grouped;
  };

  // Calculate comprehensive analytics
  const analytics = useMemo(() => {
    const allSales = [...openSales, ...closedSales];
    
    let itemCount = 0;
    let serviceCount = 0;
    let freebieCount = 0;
    let itemRevenue = 0;
    let serviceRevenue = 0;
    
    const serviceTypes = new Set();
    const itemTypes = new Set();
    const freebieTypes = new Set();
    const serviceBreakdown = {};
    const itemGroups = {};
    const paymentMethodBreakdown = {};
    const inventoryUsed = {}; // For individual item tracking

    // Group data by time period for charts
    const groupedData = groupSalesByPeriod(allSales, timePeriod);
    const chartData = Object.entries(groupedData)
      .map(([period, data]) => ({
        period,
        openSales: data.open.length,
        closedSales: data.closed.length,
        totalSales: data.total,
        revenue: data.revenue,
        displayPeriod: formatPeriodLabel(period, timePeriod)
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    allSales.forEach(sale => {
      // Payment method tracking (only for closed sales)
      if (sale.paid_at && sale.paid_using) {
        const paymentMethod = sale.paid_using;
        const saleTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) || 0) * (item.qty || 1), 0);
        
        if (!paymentMethodBreakdown[paymentMethod]) {
          paymentMethodBreakdown[paymentMethod] = { count: 0, total: 0 };
        }
        paymentMethodBreakdown[paymentMethod].count += 1;
        paymentMethodBreakdown[paymentMethod].total += saleTotal;
      }

      sale.items.forEach(item => {
        const qty = item.qty || 1;
        const price = Number(item.price) || 0;
        const revenue = price * qty;
        
        if (item.type === 'service') {
          serviceCount += qty;
          serviceRevenue += revenue;
          serviceTypes.add(item.service_name);
          
          // Service breakdown
          const serviceName = item.service_name;
          if (!serviceBreakdown[serviceName]) {
            serviceBreakdown[serviceName] = { qty: 0, price: price, total: 0 };
          }
          serviceBreakdown[serviceName].qty += qty;
          serviceBreakdown[serviceName].total += revenue;
          
        } else if (item.type === 'item') {
          if (price > 0) {
            itemCount += qty;
            itemRevenue += revenue;
            itemTypes.add(item.item_name);
          } else {
            freebieCount += qty;
            freebieTypes.add(item.item_name);
          }
          
          // Group items by category
          const itemName = item.item_name;
          const spaceIndex = itemName.indexOf(' ');
          const category = spaceIndex > 0 ? itemName.substring(0, spaceIndex) : itemName;
          
          if (!itemGroups[category]) {
            itemGroups[category] = { count: 0, revenue: 0, items: new Set() };
          }
          itemGroups[category].count += qty;
          itemGroups[category].revenue += revenue;
          itemGroups[category].items.add(itemName);

          // Individual inventory tracking (for the inventory chart)
          if (!inventoryUsed[itemName]) {
            inventoryUsed[itemName] = { count: 0, revenue: 0, isPaidItem: false, isFreebie: false };
          }
          inventoryUsed[itemName].count += qty;
          inventoryUsed[itemName].revenue += revenue;
          if (price > 0) {
            inventoryUsed[itemName].isPaidItem = true;
          } else {
            inventoryUsed[itemName].isFreebie = true;
          }
        }
      });
    });

    const openTotal = openSales.reduce((sum, sale) => 
      sum + sale.items.reduce((a, i) => a + (Number(i.price) || 0) * (i.qty || 1), 0), 0
    );

    const closedTotal = closedSales.reduce((sum, sale) => 
      sum + sale.items.reduce((a, i) => a + (Number(i.price) || 0) * (i.qty || 1), 0), 0
    );

    return {
      openTotal,
      closedTotal,
      grandTotal: openTotal + closedTotal,
      itemCount,
      serviceCount,
      freebieCount,
      itemRevenue,
      serviceRevenue,
      uniqueServices: serviceTypes.size,
      uniqueItems: itemTypes.size,
      uniqueFreebies: freebieTypes.size,
      chartData,
      serviceBreakdown: Object.entries(serviceBreakdown)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total),
      itemGroups: Object.entries(itemGroups)
        .map(([category, data]) => ({ 
          category, 
          count: data.count, 
          revenue: data.revenue,
          uniqueItems: data.items.size 
        }))
        .sort((a, b) => b.count - a.count),
      inventoryUsed: Object.entries(inventoryUsed)
        .map(([name, data]) => ({ 
          name, 
          count: data.count, 
          revenue: data.revenue,
          isPaidItem: data.isPaidItem,
          isFreebie: data.isFreebie,
          type: data.isPaidItem && data.isFreebie ? 'Both' : data.isPaidItem ? 'Paid' : 'Freebie'
        }))
        .sort((a, b) => b.count - a.count),
      paymentMethodBreakdown
    };
  }, [openSales, closedSales, timePeriod]);

  // Initialize visible items when inventory data changes
  useEffect(() => {
    if (analytics.inventoryUsed.length > 0) {
      // Initially show top 8 items
      const topItems = analytics.inventoryUsed.slice(0, 8).map(item => item.name);
      setVisibleItems(new Set(topItems));
    }
  }, [analytics.inventoryUsed]);

  // Toggle item visibility
  const toggleItemVisibility = (itemName) => {
    const newVisibleItems = new Set(visibleItems);
    if (newVisibleItems.has(itemName)) {
      newVisibleItems.delete(itemName);
    } else {
      newVisibleItems.add(itemName);
    }
    setVisibleItems(newVisibleItems);
  };

  // Get filtered data for chart (only visible items)
  const visibleInventoryData = analytics.inventoryUsed.filter(item => 
    visibleItems.has(item.name)
  );

  // Chart colors
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  return (
    <div className="space-y-6">
      {/* Time Period Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Time Period Analysis
        </h3>
        <div className="flex flex-wrap gap-2">
          {timePeriodOptions.map(option => (
            <button
              key={option.id}
              onClick={() => setTimePeriod(option.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                timePeriod === option.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span>{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Revenue Trend ({timePeriod})
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="displayPeriod" 
                  tick={{ fontSize: 12 }}
                  className="text-gray-600 dark:text-gray-400"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-gray-600 dark:text-gray-400"
                />
                <Tooltip 
                  formatter={(value) => [safeFormatCurrency(value), 'Revenue']}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{ 
                    backgroundColor: '#f9fafb', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales Volume Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Sales Volume ({timePeriod})
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="displayPeriod" 
                  tick={{ fontSize: 12 }}
                  className="text-gray-600 dark:text-gray-400"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-gray-600 dark:text-gray-400"
                />
                <Tooltip 
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{ 
                    backgroundColor: '#f9fafb', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="openSales" 
                  fill="#3B82F6" 
                  name="Open Sales"
                  radius={[2, 2, 0, 0]}
                />
                <Bar 
                  dataKey="closedSales" 
                  fill="#10B981" 
                  name="Closed Sales"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Payment Methods Pie Chart */}
      {Object.keys(analytics.paymentMethodBreakdown).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Payment Methods Distribution
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(analytics.paymentMethodBreakdown).map(([method, data], index) => ({
                      name: method,
                      value: data.total,
                      count: data.count,
                      color: COLORS[index % COLORS.length]
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {Object.entries(analytics.paymentMethodBreakdown).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name, props) => [
                      safeFormatCurrency(value), 
                      `${name} (${props.payload.count} transactions)`
                    ]}
                    contentStyle={{ 
                      backgroundColor: '#f9fafb', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(analytics.paymentMethodBreakdown).map(([method, data]) => (
                <div key={method} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                      {method}
                    </h4>
                    <span className="text-2xl">
                      {method.toLowerCase() === 'cash' ? '💵' : 
                       method.toLowerCase() === 'gcash' ? '📱' : 
                       method.toLowerCase() === 'card' ? '💳' : '💰'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {safeFormatCurrency(data.total)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {data.count} transaction{data.count !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      Avg: {safeFormatCurrency(data.total / data.count)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Individual Items Distribution Chart */}
      {analytics.inventoryUsed.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Individual Items Distribution
          </h3>
          
          {/* Item Toggle Controls */}
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">
                Toggle Items ({visibleItems.size} of {analytics.inventoryUsed.length} shown)
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => setVisibleItems(new Set(analytics.inventoryUsed.map(item => item.name)))}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Show All
                </button>
                <button
                  onClick={() => setVisibleItems(new Set())}
                  className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Hide All
                </button>
                <button
                  onClick={() => setVisibleItems(new Set(analytics.inventoryUsed.slice(0, 8).map(item => item.name)))}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Top 8
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {analytics.inventoryUsed.map((item, index) => (
                <button
                  key={item.name}
                  onClick={() => toggleItemVisibility(item.name)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    visibleItems.has(item.name)
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-500'
                  }`}
                >
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: visibleItems.has(item.name) ? COLORS[index % COLORS.length] : '#9CA3AF' }}
                  ></div>
                  <span className="max-w-24 truncate">{item.name}</span>
                  <span className="text-xs opacity-75">({item.count})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64">
              {visibleInventoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={visibleInventoryData.map((item, index) => ({
                        name: item.name,
                        value: item.count,
                        revenue: item.revenue,
                        type: item.type,
                        color: COLORS[analytics.inventoryUsed.findIndex(i => i.name === item.name) % COLORS.length]
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name.length > 15 ? name.substring(0, 12) + '...' : name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {visibleInventoryData.map((item, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[analytics.inventoryUsed.findIndex(i => i.name === item.name) % COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => [
                        `${value} units`, 
                        `${name} (${props.payload.type}${props.payload.revenue > 0 ? `, ${safeFormatCurrency(props.payload.revenue)}` : ', Free'})`
                      ]}
                      contentStyle={{ 
                        backgroundColor: '#f9fafb', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📊</div>
                    <p className="text-gray-600 dark:text-gray-400">No items selected</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      Toggle items above to display
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                Item Details ({analytics.inventoryUsed.length} total)
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {analytics.inventoryUsed.slice(0, 10).map((item, index) => (
                  <div 
                    key={item.name} 
                    className={`flex items-center justify-between p-2 rounded transition-opacity ${
                      visibleItems.has(item.name) 
                        ? 'bg-gray-50 dark:bg-gray-700 opacity-100' 
                        : 'bg-gray-100 dark:bg-gray-600 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleItemVisibility(item.name)}
                        className="w-3 h-3 rounded-full border-2 border-gray-300 dark:border-gray-500 hover:border-blue-500 transition-colors"
                        style={{ 
                          backgroundColor: visibleItems.has(item.name) ? COLORS[index % COLORS.length] : 'transparent'
                        }}
                      ></button>
                      <div className="flex-1">
                        <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                          {item.name}
                        </span>
                        <div className="flex gap-2 mt-1">
                          {item.isPaidItem && (
                            <span className="px-1 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs">
                              Paid
                            </span>
                          )}
                          {item.isFreebie && (
                            <span className="px-1 py-0.5 bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200 rounded text-xs">
                              Freebie
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-bold text-gray-900 dark:text-gray-100">
                        {item.count} units
                      </div>
                      {item.revenue > 0 && (
                        <div className="text-green-600 dark:text-green-400 font-medium">
                          {safeFormatCurrency(item.revenue)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {visibleInventoryData.reduce((sum, item) => sum + item.count, 0)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Visible Units</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {safeFormatCurrency(visibleInventoryData.reduce((sum, item) => sum + item.revenue, 0))}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Visible Revenue</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Services vs Items Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Services vs Items vs Freebies
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Count Distribution */}
          <div className="h-64">
            <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
              Count Distribution
            </h4>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Services', value: analytics.serviceCount, color: '#F59E0B' },
                    { name: 'Items', value: analytics.itemCount, color: '#06B6D4' },
                    { name: 'Freebies', value: analytics.freebieCount, color: '#EC4899' }
                  ].filter(item => item.value > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[
                    { name: 'Services', value: analytics.serviceCount, color: '#F59E0B' },
                    { name: 'Items', value: analytics.itemCount, color: '#06B6D4' },
                    { name: 'Freebies', value: analytics.freebieCount, color: '#EC4899' }
                  ].filter(item => item.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name) => [`${value} units`, name]}
                  contentStyle={{ 
                    backgroundColor: '#f9fafb', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Distribution */}
          <div className="h-64">
            <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
              Revenue Distribution
            </h4>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Services', value: analytics.serviceRevenue, color: '#F59E0B' },
                    { name: 'Items', value: analytics.itemRevenue, color: '#06B6D4' }
                  ].filter(item => item.value > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[
                    { name: 'Services', value: analytics.serviceRevenue, color: '#F59E0B' },
                    { name: 'Items', value: analytics.itemRevenue, color: '#06B6D4' }
                  ].filter(item => item.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name) => [safeFormatCurrency(value), name]}
                  contentStyle={{ 
                    backgroundColor: '#f9fafb', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Sales */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Open Sales</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {openSales.length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {safeFormatCurrency(analytics.openTotal)}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 text-xl">📋</span>
            </div>
          </div>
        </div>

        {/* Closed Sales */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Closed Sales</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {closedSales.length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {safeFormatCurrency(analytics.closedTotal)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <span className="text-green-600 dark:text-green-400 text-xl">✅</span>
            </div>
          </div>
        </div>

        {/* Total Sales */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border-2 border-indigo-200 dark:border-indigo-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Sales</p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {openSales.length + closedSales.length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {safeFormatCurrency(analytics.grandTotal)}
              </p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
              <span className="text-indigo-600 dark:text-indigo-400 text-xl">💎</span>
            </div>
          </div>
        </div>

        {/* Average Sale */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Average Sale</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {safeFormatCurrency(
                  (openSales.length + closedSales.length) > 0 
                    ? analytics.grandTotal / (openSales.length + closedSales.length)
                    : 0
                )}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Per transaction
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
              <span className="text-purple-600 dark:text-purple-400 text-xl">📊</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items and Services Count */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Services */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Services
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {analytics.serviceCount}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Services</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-500 dark:text-orange-300">
                {analytics.uniqueServices}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Unique Types</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            <p className="text-lg font-bold text-orange-700 dark:text-orange-300">
              {safeFormatCurrency(analytics.serviceRevenue)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">Revenue</p>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Items
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                {analytics.itemCount}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Items</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-teal-500 dark:text-teal-300">
                {analytics.uniqueItems}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Unique Types</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            <p className="text-lg font-bold text-teal-700 dark:text-teal-300">
              {safeFormatCurrency(analytics.itemRevenue)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">Revenue</p>
          </div>
        </div>

        {/* Freebies */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Freebies
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                {analytics.freebieCount}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Freebies</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-pink-500 dark:text-pink-300">
                {analytics.uniqueFreebies}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Unique Types</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            <p className="text-lg font-bold text-pink-700 dark:text-pink-300">
              FREE
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">No Cost</p>
          </div>
        </div>
      </div>

      {/* Services Breakdown */}
      {analytics.serviceBreakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Services Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-600">
                  <th className="text-left py-2 text-gray-900 dark:text-gray-100">Service Name</th>
                  <th className="text-center py-2 text-gray-900 dark:text-gray-100">Qty</th>
                  <th className="text-right py-2 text-gray-900 dark:text-gray-100">Price</th>
                  <th className="text-right py-2 text-gray-900 dark:text-gray-100">Total</th>
                </tr>
              </thead>
              <tbody>
                {analytics.serviceBreakdown.map(service => (
                  <tr key={service.name} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 text-gray-900 dark:text-gray-100 font-medium">
                      {service.name}
                    </td>
                    <td className="py-2 text-center text-gray-700 dark:text-gray-300">
                      {service.qty}
                    </td>
                    <td className="py-2 text-right text-gray-700 dark:text-gray-300">
                      {safeFormatCurrency(service.price)}
                    </td>
                    <td className="py-2 text-right text-gray-900 dark:text-gray-100 font-semibold">
                      {safeFormatCurrency(service.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 dark:border-gray-500">
                  <td className="py-2 text-gray-900 dark:text-gray-100 font-bold">Total</td>
                  <td className="py-2 text-center text-gray-900 dark:text-gray-100 font-bold">
                    {analytics.serviceBreakdown.reduce((sum, service) => sum + service.qty, 0)}
                  </td>
                  <td className="py-2"></td>
                  <td className="py-2 text-right text-gray-900 dark:text-gray-100 font-bold">
                    {safeFormatCurrency(analytics.serviceBreakdown.reduce((sum, service) => sum + service.total, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Item Groups */}
      {analytics.itemGroups.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Item Categories Used
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {analytics.itemGroups.map(group => (
              <div key={group.category} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    [{group.category}]
                  </h4>
                  <span className="text-2xl">📦</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Units Used:</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {group.count}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Unique Items:</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {group.uniqueItems}
                    </span>
                  </div>
                  {group.revenue > 0 && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Revenue:</span>
                        <span className="font-bold text-green-600 dark:text-green-400">
                          {safeFormatCurrency(group.revenue)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}