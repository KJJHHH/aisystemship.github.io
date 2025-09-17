import streamlit as st
from streamlit_folium import st_folium
import folium

st.set_page_config(layout="wide")

st.sidebar.header("事件清單")
if st.sidebar.button("＋ 新增事件"):
    st.sidebar.write("建立新事件...")

# 左側事件卡
with st.sidebar:
    st.write("### #EVT-001")
    st.write("暗船｜INVESTIGATE")
    st.write("### #EVT-002")
    st.write("指定船｜TRIAGE")

# 中間地圖
m = folium.Map(location=[23.5, 121], zoom_start=5)
folium.Circle([23.5, 121], radius=200000, color="red", fill=True).add_to(m)
map_data = st_folium(m, width=700, height=500)

# 右側詳情
st.markdown("## TRIAGE 詳情")
st.write("目標：暗船")
st.write("狀態：INVESTIGATE")
if st.button("開始調查"):
    st.success("事件進入 INVESTIGATE 流程")
